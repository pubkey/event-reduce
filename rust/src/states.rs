use std::cmp::Ordering;
use std::hash::Hash;

use crate::types::{ChangeEvent, StateName, StateResolveFunctionInput};
use crate::util::index_of_document_id;

pub type StateResolveFunction<D, K> = fn(&StateResolveFunctionInput<D, K>) -> bool;

/// All states, in the same order as the JavaScript implementation.
/// The BDD references the states by their index in this list.
pub const ORDERED_STATE_LIST: [StateName; 18] = [
    StateName::IsInsert,
    StateName::IsUpdate,
    StateName::IsDelete,
    StateName::HasLimit,
    StateName::IsFindOne,
    StateName::HasSkip,
    StateName::WasResultsEmpty,
    StateName::WasLimitReached,
    StateName::WasFirst,
    StateName::WasLast,
    StateName::SortParamsChanged,
    StateName::WasInResult,
    StateName::WasSortedBeforeFirst,
    StateName::WasSortedAfterLast,
    StateName::IsSortedBeforeFirst,
    StateName::IsSortedAfterLast,
    StateName::WasMatching,
    StateName::DoesMatchNow,
];

pub fn state_resolve_function<D, K: Eq + Hash>(state: StateName) -> StateResolveFunction<D, K> {
    match state {
        StateName::IsInsert => is_insert,
        StateName::IsUpdate => is_update,
        StateName::IsDelete => is_delete,
        StateName::HasLimit => has_limit,
        StateName::IsFindOne => is_find_one,
        StateName::HasSkip => has_skip,
        StateName::WasResultsEmpty => was_results_empty,
        StateName::WasLimitReached => was_limit_reached,
        StateName::WasFirst => was_first,
        StateName::WasLast => was_last,
        StateName::SortParamsChanged => sort_params_changed,
        StateName::WasInResult => was_in_result,
        StateName::WasSortedBeforeFirst => was_sorted_before_first,
        StateName::WasSortedAfterLast => was_sorted_after_last,
        StateName::IsSortedBeforeFirst => is_sorted_before_first,
        StateName::IsSortedAfterLast => is_sorted_after_last,
        StateName::WasMatching => was_matching,
        StateName::DoesMatchNow => does_match_now,
    }
}

/// Resolves the state with the given index in ORDERED_STATE_LIST.
#[inline]
pub(crate) fn resolve_state_by_index<D, K: Eq + Hash>(
    index: u8,
    input: &StateResolveFunctionInput<D, K>,
) -> bool {
    match index {
        0 => is_insert(input),
        1 => is_update(input),
        2 => is_delete(input),
        3 => has_limit(input),
        4 => is_find_one(input),
        5 => has_skip(input),
        6 => was_results_empty(input),
        7 => was_limit_reached(input),
        8 => was_first(input),
        9 => was_last(input),
        10 => sort_params_changed(input),
        11 => was_in_result(input),
        12 => was_sorted_before_first(input),
        13 => was_sorted_after_last(input),
        14 => is_sorted_before_first(input),
        15 => is_sorted_after_last(input),
        16 => was_matching(input),
        17 => does_match_now(input),
        _ => panic!("EventReduce:UNK_STATE {}", index),
    }
}

pub fn resolve_state<D, K: Eq + Hash>(
    state: StateName,
    input: &StateResolveFunctionInput<D, K>,
) -> bool {
    state_resolve_function(state)(input)
}

/// Returns the binary representation of all states
/// like '010110110111...' where the first '0' means that the first state is false.
pub fn get_state_set<D, K: Eq + Hash>(input: &StateResolveFunctionInput<D, K>) -> String {
    ORDERED_STATE_LIST
        .iter()
        .map(|state| {
            if resolve_state(*state, input) {
                '1'
            } else {
                '0'
            }
        })
        .collect()
}

pub fn has_limit<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    matches!(input.query_params.limit, Some(limit) if limit > 0)
}

pub fn is_find_one<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    input.query_params.limit == Some(1)
}

pub fn has_skip<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    matches!(input.query_params.skip, Some(skip) if skip > 0)
}

pub fn is_delete<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    matches!(input.change_event, ChangeEvent::Delete { .. })
}

pub fn is_insert<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    matches!(input.change_event, ChangeEvent::Insert { .. })
}

pub fn is_update<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    matches!(input.change_event, ChangeEvent::Update { .. })
}

pub fn was_limit_reached<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    matches!(input.query_params.limit, Some(limit) if limit > 0 && input.previous_results.len() >= limit)
}

pub fn sort_params_changed<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    match (input.change_event.previous(), input.change_event.doc()) {
        (_, None) => false,
        (None, Some(_)) => true,
        (Some(prev), Some(doc)) => (input.query_params.sort_fields_changed)(prev, doc),
    }
}

pub fn was_in_result<D, K: Eq + Hash>(input: &StateResolveFunctionInput<D, K>) -> bool {
    let id = input.change_event.id();
    match input.key_document_map {
        Some(map) => map.contains_key(id),
        None => index_of_document_id(input.query_params, input.previous_results, id).is_some(),
    }
}

pub fn was_first<D, K: Eq>(input: &StateResolveFunctionInput<D, K>) -> bool {
    match input.previous_results.first() {
        Some(first) => input.query_params.document_id(first) == input.change_event.id(),
        None => false,
    }
}

pub fn was_last<D, K: Eq>(input: &StateResolveFunctionInput<D, K>) -> bool {
    match input.previous_results.last() {
        Some(last) => input.query_params.document_id(last) == input.change_event.id(),
        None => false,
    }
}

/// Compares the given document with the given result item.
/// If the changed document is the result item itself,
/// we cannot sort-compare them, because it might end in a non-deterministic
/// sort order. Because both document could be equal.
/// So instead we have to return true.
fn compare_with_result<D, K: Eq>(
    input: &StateResolveFunctionInput<D, K>,
    doc: Option<&D>,
    result_item: Option<&D>,
    expected: Ordering,
) -> bool {
    let (doc, result_item) = match (doc, result_item) {
        (Some(doc), Some(result_item)) => (doc, result_item),
        _ => return false,
    };
    if input.query_params.document_id(result_item) == input.change_event.id() {
        return true;
    }
    (input.query_params.sort_comparator)(doc, result_item) == expected
}

pub fn was_sorted_before_first<D, K: Eq>(input: &StateResolveFunctionInput<D, K>) -> bool {
    compare_with_result(
        input,
        input.change_event.previous(),
        input.previous_results.first(),
        Ordering::Less,
    )
}

pub fn was_sorted_after_last<D, K: Eq>(input: &StateResolveFunctionInput<D, K>) -> bool {
    compare_with_result(
        input,
        input.change_event.previous(),
        input.previous_results.last(),
        Ordering::Greater,
    )
}

/// Like compare_with_result(), but if the changed document is the result item itself,
/// it compares with the neighbor of the result item instead,
/// so we know if the changed document still sorts first or last.
/// If there is no neighbor, the changed document is still first or last.
fn compare_new_doc_with_result<D, K: Eq>(
    input: &StateResolveFunctionInput<D, K>,
    result_item: Option<&D>,
    neighbor: Option<&D>,
    expected: Ordering,
) -> bool {
    let (doc, mut result_item) = match (input.change_event.doc(), result_item) {
        (Some(doc), Some(result_item)) => (doc, result_item),
        _ => return false,
    };
    if input.query_params.document_id(result_item) == input.change_event.id() {
        match neighbor {
            Some(neighbor) => result_item = neighbor,
            None => return true,
        }
    }
    (input.query_params.sort_comparator)(doc, result_item) == expected
}

pub fn is_sorted_before_first<D, K: Eq>(input: &StateResolveFunctionInput<D, K>) -> bool {
    let results = input.previous_results;
    compare_new_doc_with_result(input, results.first(), results.get(1), Ordering::Less)
}

pub fn is_sorted_after_last<D, K: Eq>(input: &StateResolveFunctionInput<D, K>) -> bool {
    let results = input.previous_results;
    let neighbor = results.len().checked_sub(2).and_then(|i| results.get(i));
    compare_new_doc_with_result(input, results.last(), neighbor, Ordering::Greater)
}

pub fn was_matching<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    match input.change_event.previous() {
        Some(prev) => (input.query_params.query_matcher)(prev),
        None => false,
    }
}

pub fn does_match_now<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    match input.change_event.doc() {
        Some(doc) => (input.query_params.query_matcher)(doc),
        None => false,
    }
}

pub fn was_results_empty<D, K>(input: &StateResolveFunctionInput<D, K>) -> bool {
    input.previous_results.is_empty()
}
