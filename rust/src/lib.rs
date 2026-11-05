#![doc = include_str!("../README.md")]

mod actions;
mod bdd;
mod bdd_generated;
mod result_window_buffer;
mod states;
mod types;
mod util;

use std::hash::Hash;

pub use actions::*;
pub use bdd::{resolve_input, PACKED_BDD};
pub use result_window_buffer::*;
pub use states::*;
pub use types::*;
pub use util::*;

/// Returns the action that transforms the previous results into the new results.
/// If it is `ActionName::RunFullQueryAgain`, the query must be run over the database again.
pub fn calculate_action_name<D, K: Eq + Hash>(
    input: &StateResolveFunctionInput<D, K>,
) -> ActionName {
    ORDERED_ACTION_LIST[resolve_input(input)]
}

/// Applies the action to the results, which are mutated in place.
/// The key document map, if given, is kept in sync with the results.
/// Returns an error for `RunFullQueryAgain` and `UnknownAction`,
/// in that case the results are not changed.
pub fn run_action<D: Clone, K: Eq + Hash + Clone>(
    action: ActionName,
    query_params: &QueryParams<D, K>,
    change_event: &ChangeEvent<D, K>,
    previous_results: &mut Vec<D>,
    key_document_map: Option<&mut ResultKeyDocumentMap<D, K>>,
) -> Result<(), EventReduceError> {
    action_function(action)(&mut ActionFunctionInput {
        query_params,
        change_event,
        previous_results,
        key_document_map,
    })
}
