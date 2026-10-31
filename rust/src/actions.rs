use std::hash::Hash;

use crate::types::{ActionFunctionInput, ActionName, EventReduceError};
use crate::util::{index_of_document_id, push_at_sort_position};

pub type ActionFunction<D, K> = fn(&mut ActionFunctionInput<D, K>) -> Result<(), EventReduceError>;

/// All actions, in the same order as the JavaScript implementation.
/// The BDD references the actions by their index in this list.
pub const ORDERED_ACTION_LIST: [ActionName; 18] = [
    ActionName::DoNothing,
    ActionName::InsertFirst,
    ActionName::InsertLast,
    ActionName::RemoveFirstItem,
    ActionName::RemoveLastItem,
    ActionName::RemoveFirstInsertLast,
    ActionName::RemoveLastInsertFirst,
    ActionName::RemoveFirstInsertFirst,
    ActionName::RemoveLastInsertLast,
    ActionName::RemoveExisting,
    ActionName::ReplaceExisting,
    ActionName::AlwaysWrong,
    ActionName::InsertAtSortPosition,
    ActionName::RemoveExistingAndInsertAtSortPosition,
    ActionName::InsertAtSortPositionRemoveLast,
    ActionName::InsertAtSortPositionRemoveFirst,
    ActionName::RunFullQueryAgain,
    ActionName::UnknownAction,
];

/// Returns the function of the given action.
/// AlwaysWrong is only used by the truth-table generator and never
/// returned by the BDD, so it is mapped to unknown_action here.
pub fn action_function<D: Clone, K: Eq + Hash + Clone>(action: ActionName) -> ActionFunction<D, K> {
    match action {
        ActionName::DoNothing => do_nothing,
        ActionName::InsertFirst => insert_first,
        ActionName::InsertLast => insert_last,
        ActionName::RemoveFirstItem => remove_first_item,
        ActionName::RemoveLastItem => remove_last_item,
        ActionName::RemoveFirstInsertLast => remove_first_insert_last,
        ActionName::RemoveLastInsertFirst => remove_last_insert_first,
        ActionName::RemoveFirstInsertFirst => remove_first_insert_first,
        ActionName::RemoveLastInsertLast => remove_last_insert_last,
        ActionName::RemoveExisting => remove_existing,
        ActionName::ReplaceExisting => replace_existing,
        ActionName::AlwaysWrong => unknown_action,
        ActionName::InsertAtSortPosition => insert_at_sort_position,
        ActionName::RemoveExistingAndInsertAtSortPosition => {
            remove_existing_and_insert_at_sort_position
        }
        ActionName::InsertAtSortPositionRemoveLast => insert_at_sort_position_remove_last,
        ActionName::InsertAtSortPositionRemoveFirst => insert_at_sort_position_remove_first,
        ActionName::RunFullQueryAgain => run_full_query_again,
        ActionName::UnknownAction => unknown_action,
    }
}

/// Returns the index of the changed document inside of the previous results.
fn find_index_of_changed_doc<D, K: Eq + Hash>(input: &ActionFunctionInput<D, K>) -> Option<usize> {
    let id = input.change_event.id();
    if let Some(map) = input.key_document_map.as_deref() {
        if !map.contains_key(id) {
            return None;
        }
    }
    index_of_document_id(input.query_params, input.previous_results, id)
}

/// The new document of the change event.
/// Only the BDD knows that it exists for the given action,
/// so a missing document is reported as an unknown action.
fn changed_doc<D: Clone, K>(input: &ActionFunctionInput<D, K>) -> Result<D, EventReduceError> {
    input
        .change_event
        .doc()
        .cloned()
        .ok_or(EventReduceError::UnknownAction)
}

fn add_to_map<D: Clone, K: Eq + Hash + Clone>(input: &mut ActionFunctionInput<D, K>, doc: &D) {
    if let Some(map) = input.key_document_map.as_deref_mut() {
        map.insert(input.change_event.id().clone(), doc.clone());
    }
}

fn remove_from_map<D, K: Eq + Hash>(input: &mut ActionFunctionInput<D, K>, removed: Option<D>) {
    if let (Some(map), Some(removed)) = (input.key_document_map.as_deref_mut(), removed) {
        map.remove(input.query_params.document_id(&removed));
    }
}

pub fn do_nothing<D, K>(_input: &mut ActionFunctionInput<D, K>) -> Result<(), EventReduceError> {
    Ok(())
}

pub fn insert_first<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    let doc = changed_doc(input)?;
    add_to_map(input, &doc);
    input.previous_results.insert(0, doc);
    Ok(())
}

pub fn insert_last<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    let doc = changed_doc(input)?;
    add_to_map(input, &doc);
    input.previous_results.push(doc);
    Ok(())
}

pub fn remove_first_item<D, K: Eq + Hash>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    let first = (!input.previous_results.is_empty()).then(|| input.previous_results.remove(0));
    remove_from_map(input, first);
    Ok(())
}

pub fn remove_last_item<D, K: Eq + Hash>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    let last = input.previous_results.pop();
    remove_from_map(input, last);
    Ok(())
}

pub fn remove_first_insert_last<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    remove_first_item(input)?;
    insert_last(input)
}

pub fn remove_last_insert_first<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    remove_last_item(input)?;
    insert_first(input)
}

pub fn remove_first_insert_first<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    remove_first_item(input)?;
    insert_first(input)
}

pub fn remove_last_insert_last<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    remove_last_item(input)?;
    insert_last(input)
}

pub fn remove_existing<D, K: Eq + Hash>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    let index = find_index_of_changed_doc(input);
    if let Some(map) = input.key_document_map.as_deref_mut() {
        map.remove(input.change_event.id());
    }
    if let Some(index) = index {
        input.previous_results.remove(index);
    }
    Ok(())
}

pub fn replace_existing<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    if let Some(index) = find_index_of_changed_doc(input) {
        let doc = changed_doc(input)?;
        add_to_map(input, &doc);
        input.previous_results[index] = doc;
    }
    Ok(())
}

pub fn insert_at_sort_position<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    let id = input.change_event.id();
    /*
     * If document is already in results,
     * we cannot add it again because it would throw on non-deterministic ordering.
     */
    let is_doc_in_results = match input.key_document_map.as_deref() {
        Some(map) => map.contains_key(id),
        None => index_of_document_id(input.query_params, input.previous_results, id).is_some(),
    };
    if is_doc_in_results {
        return Ok(());
    }
    let doc = changed_doc(input)?;
    add_to_map(input, &doc);
    push_at_sort_position(
        input.previous_results,
        doc,
        &*input.query_params.sort_comparator,
    );
    Ok(())
}

pub fn remove_existing_and_insert_at_sort_position<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    remove_existing(input)?;
    insert_at_sort_position(input)
}

/// Inserts the document at its sort position and then runs `remove`.
/// insert_at_sort_position() does nothing if the document is already in the results,
/// then nothing is removed either.
fn insert_at_sort_position_and_remove<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
    remove: ActionFunction<D, K>,
) -> Result<(), EventReduceError> {
    let length_before = input.previous_results.len();
    insert_at_sort_position(input)?;
    if input.previous_results.len() > length_before {
        remove(input)?;
    }
    Ok(())
}

/// Inserts the document at its sort position and then removes the last document.
/// Used when the limit was reached and the new document
/// sorts in between the first and the last document,
/// so the previous last document is pushed out of the results.
pub fn insert_at_sort_position_remove_last<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    insert_at_sort_position_and_remove(input, remove_last_item)
}

/// Inserts the document at its sort position and then removes the first document.
/// Used when a document moves out of the skipped documents into the results,
/// so the previous first document is pushed into the skipped documents.
pub fn insert_at_sort_position_remove_first<D: Clone, K: Eq + Hash + Clone>(
    input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    insert_at_sort_position_and_remove(input, remove_first_item)
}

pub fn run_full_query_again<D, K>(
    _input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    Err(EventReduceError::RunFullQueryAgain)
}

pub fn unknown_action<D, K>(
    _input: &mut ActionFunctionInput<D, K>,
) -> Result<(), EventReduceError> {
    Err(EventReduceError::UnknownAction)
}
