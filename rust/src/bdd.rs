use std::hash::Hash;

use crate::states::resolve_state_by_index;
use crate::types::StateResolveFunctionInput;

pub use crate::bdd_generated::PACKED_BDD;

/*

The BDD is shared with the JavaScript implementation as the entries of a PackedBdd
of the binary-decision-diagram npm package.

Layout of the entries:
- Every non-leaf node takes three consecutive entries: [level, ref0, ref1]
  - level is the index of the state function in ORDERED_STATE_LIST
  - ref0 is followed when the state is false, ref1 when it is true
- The node with the id x starts at index 3 * x, the root node has the id 0.
- With n = entries.len() / 3, a reference r < n points to the node with the id r,
  r >= n is a leaf with the action index r - n in ORDERED_ACTION_LIST.

*/

/// The index of `ActionName::DoNothing` in ORDERED_ACTION_LIST.
const DO_NOTHING_ACTION_INDEX: usize = 0;

/// Walks the BDD and returns the index of the action in ORDERED_ACTION_LIST.
///
/// Like in SQL, a query with limit 0 returns no documents: no change event can change
/// its empty results, so the action is always `ActionName::DoNothing`.
/// (A negative limit, which is an error in the other implementations, cannot be expressed here.)
pub fn resolve_input<D, K: Eq + Hash>(input: &StateResolveFunctionInput<D, K>) -> usize {
    if input.query_params.limit == Some(0) {
        return DO_NOTHING_ACTION_INDEX;
    }
    let n = PACKED_BDD.len() / 3;
    let mut i = 0;
    loop {
        let branch = if resolve_state_by_index(PACKED_BDD[i] as usize, input) {
            2
        } else {
            1
        };
        let reference = PACKED_BDD[i + branch] as usize;
        if reference >= n {
            return reference - n;
        }
        i = reference * 3;
    }
}
