use std::cmp::Ordering;

use crate::types::QueryParams;

/// Returns the index of the document with the given id
/// or `None` if it is not in the given documents.
pub fn index_of_document_id<D, K: Eq>(
    query_params: &QueryParams<D, K>,
    docs: &[D],
    id: &K,
) -> Option<usize> {
    docs.iter()
        .position(|doc| query_params.document_id(doc) == id)
}

/// Inserts the item at its sort position, which is much faster than re-sorting the array.
/// Items that are equal to the new item stay before it.
/// Returns the index at which the item was inserted.
pub fn push_at_sort_position<D>(
    array: &mut Vec<D>,
    item: D,
    compare: impl Fn(&D, &D) -> Ordering,
) -> usize {
    // Shortcut: the item belongs at the end, push() is O(1).
    match array.last() {
        None => {
            array.push(item);
            return 0;
        }
        Some(last) if compare(last, &item) != Ordering::Greater => {
            array.push(item);
            return array.len() - 1;
        }
        _ => {}
    }
    let index = array.partition_point(|existing| compare(existing, &item) != Ordering::Greater);
    array.insert(index, item);
    index
}
