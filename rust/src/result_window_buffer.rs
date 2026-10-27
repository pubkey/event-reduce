//! Result window buffer
//!
//! For a query with a limit or a skip, EventReduce returns RunFullQueryAgain
//! when a row has to move into the result window that is not in the previous results:
//! the row after the last row (a row left a full window) or the last skipped row
//! (a row was added in front of the window).
//! The result window buffer keeps rows on both sides of the window in memory,
//! so these rows can be taken from memory instead.
//! See docs/result-window-buffer.md for the explanation and measurements.
//!
//! Invariant: `buffer` is always an exact, contiguous slice of the full sorted result
//! (without skip and limit): exactly `offset` matching rows sort before its first row,
//! and it never contains a wrong row or misses a row in between.
//! If `complete` is true, there are no rows after its last row.
//! Only if the buffer is empty, `offset` can be larger than the real number of rows.

use std::cmp::Ordering;
use std::collections::HashMap;
use std::hash::Hash;
use std::ops::RangeBounds;

use crate::{
    calculate_action_name, index_of_document_id, push_at_sort_position, run_action, ActionName,
    ChangeEvent, EventReduceError, QueryParams, StateResolveFunctionInput,
};

/// Pass it as a buffer size to keep all rows on that side of the result window.
pub const RESULT_WINDOW_BUFFER_ALL_ROWS: usize = usize::MAX;

/// Buffer sizes from this value on keep all rows.
/// Keeps the arithmetic far away from an overflow.
const MAX_BUFFER_SIZE: usize = 1 << 40;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ResultWindowBufferSizes {
    /// Amount of rows to keep after the result window.
    /// Only used for queries with a limit.
    pub limit_buffer_size: usize,
    /// Amount of skipped rows to keep before the result window.
    /// Only used for queries with a skip.
    pub skip_buffer_size: usize,
}

/// What apply_change_event() did.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ResultWindowBufferResult {
    /// An EventReduce action calculated the new buffer.
    EventReduce,
    /// EventReduce could not do it (or would have dropped a row), the slice rule did it.
    Buffer,
    /// The caller must run the query with the skip and limit of query()
    /// and pass the rows to reset().
    RunFullQueryAgain,
}

impl ResultWindowBufferResult {
    /// The name as used by the JavaScript implementation.
    pub fn as_str(&self) -> &'static str {
        match self {
            ResultWindowBufferResult::EventReduce => "eventReduce",
            ResultWindowBufferResult::Buffer => "buffer",
            ResultWindowBufferResult::RunFullQueryAgain => "runFullQueryAgain",
        }
    }
}

/// The skip and limit to run the query of the buffer with.
/// `limit` is None if all rows after the skip are needed.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ResultWindowBufferQuery {
    pub skip: usize,
    pub limit: Option<usize>,
}

/// What apply_change_events() returns.
#[derive(Clone, Debug, PartialEq)]
pub enum ResultWindowBufferChangeResult<D> {
    /// Run the query of query() and pass the rows to reset().
    RunFullQueryAgain,
    /// The rows of the original skip and limit,
    /// changed is true if they are not equal to the rows before the change events.
    Results { changed: bool, results: Vec<D> },
}

/// The recommended buffer size for each side of the result window.
/// About log2(limit) for small limits, grows faster around limit 400 and is at most 30.
/// Returns 0 for a limit of 1 (like a find-one query) and for queries without a limit.
pub fn get_recommended_result_window_buffer_size(limit: Option<usize>) -> usize {
    match limit {
        None | Some(0) => 0,
        Some(limit) => {
            let limit = limit as f64;
            let size = (limit.log2() + 19.0 / (1.0 + (400.0 / limit).powi(2))).floor();
            size.min(30.0) as usize
        }
    }
}

/// RunFullQueryAgain, and the actions that keep the length of the result
/// by dropping its first or last row. The slice rule handles them instead.
fn needs_slice_rule(action: ActionName) -> bool {
    matches!(
        action,
        ActionName::RunFullQueryAgain
            | ActionName::RemoveFirstItem
            | ActionName::RemoveLastItem
            | ActionName::RemoveFirstInsertLast
            | ActionName::RemoveLastInsertFirst
            | ActionName::RemoveFirstInsertFirst
            | ActionName::RemoveLastInsertLast
            | ActionName::InsertAtSortPositionRemoveLast
            | ActionName::InsertAtSortPositionRemoveFirst
    )
}

pub struct ResultWindowBuffer<D, K> {
    /// QueryParams of the original query,
    /// with the skip and limit that are shown to the user.
    query_params: QueryParams<D, K>,
    limit_buffer_size: usize,
    skip_buffer_size: usize,
    buffer: Vec<D>,
    key_document_map: HashMap<K, D>,
    /// Number of matching rows that sort before the first row of the buffer.
    offset: usize,
    complete: bool,
}

impl<D: Clone, K: Eq + Hash + Clone + Ord> ResultWindowBuffer<D, K> {
    /// Creates an empty result window buffer.
    /// Run the query with the skip and limit of query()
    /// and pass the rows to reset() before using it.
    /// `query_params` has the skip and limit that are shown to the user.
    pub fn new(query_params: QueryParams<D, K>, sizes: ResultWindowBufferSizes) -> Self {
        // with limit 0 the result is always empty, so no rows are kept
        let is_empty_query = query_params.limit == Some(0);
        let size = |size: usize| {
            if is_empty_query {
                0
            } else {
                size.min(MAX_BUFFER_SIZE)
            }
        };
        ResultWindowBuffer {
            limit_buffer_size: size(sizes.limit_buffer_size),
            skip_buffer_size: size(sizes.skip_buffer_size),
            query_params,
            buffer: Vec::new(),
            key_document_map: HashMap::new(),
            offset: 0,
            complete: false,
        }
    }

    /// All rows that are kept in memory, the result window and the rows around it.
    pub fn buffer(&self) -> &[D] {
        &self.buffer
    }

    /// Number of matching rows that sort before the first row of the buffer.
    pub fn offset(&self) -> usize {
        self.offset
    }

    /// True if there are no rows after the last row of the buffer.
    pub fn is_complete(&self) -> bool {
        self.complete
    }

    fn skip(&self) -> i64 {
        self.query_params.skip.unwrap_or(0) as i64
    }

    /// The skip and limit to run the query of the buffer with.
    pub fn query(&self) -> ResultWindowBufferQuery {
        let skip = self.skip();
        let buffer_skip = (skip - self.skip_buffer_size as i64).max(0);
        let limit = match self.query_params.limit {
            Some(limit) if self.limit_buffer_size < MAX_BUFFER_SIZE => {
                Some((skip - buffer_skip) as usize + limit + self.limit_buffer_size)
            }
            _ => None,
        };
        ResultWindowBufferQuery {
            skip: buffer_skip as usize,
            limit,
        }
    }

    /// Set the buffer to the rows of a fresh query
    /// that ran with the skip and limit of query().
    pub fn reset(&mut self, rows: Vec<D>) {
        let query = self.query();
        let get_id = self.query_params.get_document_id;
        self.key_document_map = rows
            .iter()
            .map(|doc| (get_id(doc).clone(), doc.clone()))
            .collect();
        self.offset = query.skip;
        // fewer rows than requested means there are no more rows
        self.complete = match query.limit {
            None => true,
            Some(limit) => rows.len() < limit,
        };
        self.buffer = rows;
    }

    /// The result that is shown to the user.
    /// Returns an error if the result window is not in the buffer, which happens
    /// before reset() was called or when apply_change_event() returned RunFullQueryAgain
    /// and the query did not run again.
    pub fn results(&self) -> Result<&[D], EventReduceError> {
        if !self.is_result_window_in_buffer() {
            return Err(EventReduceError::ResultWindowOutdated);
        }
        let len = self.buffer.len();
        let start = ((self.skip() - self.offset as i64) as usize).min(len);
        let end = match self.query_params.limit {
            Some(limit) => (start + limit).min(len),
            None => len,
        };
        Ok(&self.buffer[start..end])
    }

    /// Updates the buffer with the change event.
    pub fn apply_change_event(
        &mut self,
        change_event: &ChangeEvent<D, K>,
    ) -> ResultWindowBufferResult {
        if self.query_params.limit == Some(0) {
            // the result of a query with limit 0 is always empty, nothing can change it
            return ResultWindowBufferResult::EventReduce;
        }
        if !self.complete && self.buffer.is_empty() {
            return ResultWindowBufferResult::RunFullQueryAgain;
        }

        // 1. Let EventReduce handle the buffer as if it was the result of a query
        // with skip = offset and limit = buffer.len(). This is exactly true,
        // because the buffer is an exact slice of the full result.
        // If the buffer is complete, we use buffer.len() + 1, so EventReduce
        // knows that the limit is not reached and there are no more rows.
        let original = (self.query_params.skip, self.query_params.limit);
        self.query_params.skip = if self.offset > 0 {
            Some(self.offset)
        } else {
            None
        };
        self.query_params.limit = Some(self.buffer.len() + usize::from(self.complete));
        let action = calculate_action_name(&StateResolveFunctionInput {
            query_params: &self.query_params,
            change_event,
            previous_results: &self.buffer,
            key_document_map: Some(&self.key_document_map),
        });
        let use_slice_rule = needs_slice_rule(action);
        if !use_slice_rule {
            run_action(
                action,
                &self.query_params,
                change_event,
                &mut self.buffer,
                Some(&mut self.key_document_map),
            )
            .expect("the BDD never returns an action that fails here");
        }
        (self.query_params.skip, self.query_params.limit) = original;
        let result = if use_slice_rule {
            // 2. EventReduce needs a row before or after the buffer, which it does not know,
            // or it would drop a row to keep the length of the result.
            // But the buffer does not have to keep its length, only to stay an exact slice,
            // so the slice rule lets it shrink or grow instead.
            self.apply_slice_rule(change_event);
            ResultWindowBufferResult::Buffer
        } else {
            ResultWindowBufferResult::EventReduce
        };

        // 3. Do not let the buffer grow without bounds on either side.
        self.trim();

        // 4. Run the query again if the result window does not fit into the buffer anymore.
        if !self.is_result_window_in_buffer() {
            return ResultWindowBufferResult::RunFullQueryAgain;
        }
        result
    }

    /// Updates the buffer with all change events.
    /// Returns the new results, and if they changed,
    /// or RunFullQueryAgain if the result window does not fit into the buffer anymore.
    /// Then run the query of query() and pass the rows to reset().
    pub fn apply_change_events(
        &mut self,
        change_events: &[ChangeEvent<D, K>],
    ) -> ResultWindowBufferChangeResult<D>
    where
        D: PartialEq,
    {
        let previous_results = match self.results() {
            Ok(results) => results.to_vec(),
            Err(_) => return ResultWindowBufferChangeResult::RunFullQueryAgain,
        };
        for change_event in change_events {
            if self.apply_change_event(change_event) == ResultWindowBufferResult::RunFullQueryAgain
            {
                return ResultWindowBufferChangeResult::RunFullQueryAgain;
            }
        }
        match self.results() {
            Ok(results) => ResultWindowBufferChangeResult::Results {
                changed: results != previous_results.as_slice(),
                results: results.to_vec(),
            },
            Err(_) => ResultWindowBufferChangeResult::RunFullQueryAgain,
        }
    }

    /// True if all rows of the result window are in the buffer.
    fn is_result_window_in_buffer(&self) -> bool {
        let start = self.skip() - self.offset as i64;
        if start < 0 {
            return false;
        }
        if self.complete {
            return true;
        }
        match self.query_params.limit {
            Some(limit) => self.buffer.len() >= start as usize + limit,
            None => false,
        }
    }

    /// Removes rows before the window that are more than skip_buffer_size
    /// and rows after the window that are more than limit_buffer_size.
    fn trim(&mut self) {
        let rows_before_window = self.skip() - self.offset as i64;
        let remove_from_start =
            (rows_before_window - self.skip_buffer_size as i64).min(self.buffer.len() as i64);
        if remove_from_start > 0 {
            self.remove_rows(..remove_from_start as usize);
            self.offset += remove_from_start as usize;
        }

        if let Some(limit) = self.query_params.limit {
            let max_length =
                (self.skip() - self.offset as i64).max(0) as usize + limit + self.limit_buffer_size;
            if self.buffer.len() > max_length {
                self.remove_rows(max_length..);
                self.complete = false;
            }
        }
    }

    /// Removes the rows of the range from the buffer and the key document map.
    fn remove_rows(&mut self, range: impl RangeBounds<usize>) {
        let get_id = self.query_params.get_document_id;
        for doc in self.buffer.drain(range) {
            self.key_document_map.remove(get_id(&doc));
        }
    }

    /// The slice rule:
    /// Exactly `offset` matching rows sort before the first row of the buffer,
    /// and all matching rows that sort between the first and the last row are in the buffer.
    /// After the change event, this is still true for the old first and last row, so:
    /// - the old version of the changed row is removed from the buffer,
    /// - the new version is added if it sorts between the old first and last row,
    /// - offset changes by one if the changed row moved into or out of the rows before the first row.
    ///
    /// If offset is 0, there are no rows before the first row, so a row that sorts before it is added.
    /// If the buffer is complete, there are no rows after the last row, so a row that sorts after it is added.
    ///
    /// An empty buffer (only valid when complete) knows only the number of rows before it.
    /// There, offset is only an upper bound, which stays an upper bound with the same update.
    fn apply_slice_rule(&mut self, change_event: &ChangeEvent<D, K>) {
        let previous = change_event.previous();
        let doc = change_event.doc();
        let was_matching = previous.is_some_and(|d| (self.query_params.query_matcher)(d));
        let does_match_now = doc.is_some_and(|d| (self.query_params.query_matcher)(d));

        if self.buffer.is_empty() {
            if self.offset == 0 {
                // there are no rows at all
                if let (Some(doc), true) = (doc, does_match_now) {
                    self.insert_at_sort_position(doc.clone());
                }
            } else {
                self.offset = self.offset + usize::from(does_match_now) - usize::from(was_matching);
            }
            return;
        }

        let first = &self.buffer[0];
        let last = &self.buffer[self.buffer.len() - 1];
        let has_rows_before = self.offset > 0;
        let is_before =
            |d: &D| has_rows_before && compare_rows(&self.query_params, d, first) == Ordering::Less;
        let was_before = was_matching && previous.is_some_and(is_before);
        let is_before_now = does_match_now && doc.is_some_and(is_before);
        let insert = does_match_now
            && !is_before_now
            && doc.is_some_and(|d| {
                self.complete || compare_rows(&self.query_params, d, last) != Ordering::Greater
            });

        let id = change_event.id();
        if self.key_document_map.remove(id).is_some() {
            if let Some(index) = index_of_document_id(&self.query_params, &self.buffer, id) {
                self.buffer.remove(index);
            }
        }
        if insert {
            if let Some(doc) = doc {
                self.insert_at_sort_position(doc.clone());
            }
        }
        self.offset = self.offset + usize::from(is_before_now) - usize::from(was_before);
    }

    fn insert_at_sort_position(&mut self, doc: D) {
        self.key_document_map
            .insert(self.query_params.document_id(&doc).clone(), doc.clone());
        push_at_sort_position(&mut self.buffer, doc, |a, b| {
            compare_rows(&self.query_params, a, b)
        });
    }
}

/// Compares two rows with the sort comparator of the query.
/// Returns Equal only for two versions of the same row that sort at the same position.
/// For different rows that the comparator sees as equal,
/// the primary key decides, so that the order is always deterministic.
fn compare_rows<D, K: Ord>(query_params: &QueryParams<D, K>, a: &D, b: &D) -> Ordering {
    let id_a = query_params.document_id(a);
    let id_b = query_params.document_id(b);
    let result = (query_params.sort_comparator)(a, b);
    if id_a == id_b {
        // A deterministic comparator breaks ties by the primary key,
        // which gives the same answer for both directions when the sort values are equal.
        if result == Ordering::Equal || result == (query_params.sort_comparator)(b, a) {
            return Ordering::Equal;
        }
        return result;
    }
    if result != Ordering::Equal {
        return result;
    }
    id_a.cmp(id_b)
}
