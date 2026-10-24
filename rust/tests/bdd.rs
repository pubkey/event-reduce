use event_reduce::{
    calculate_action_name, ActionName, StateResolveFunctionInput, ORDERED_ACTION_LIST,
    ORDERED_STATE_LIST, PACKED_BDD, PACKED_BDD_STRING,
};

mod common;
use common::*;

#[test]
fn packed_bdd_string_is_the_same_as_in_the_javascript_implementation() {
    let js = include_str!("../../javascript/src/bdd/bdd.generated.ts");
    let expected = format!("export const packedBddString = '{}';", PACKED_BDD_STRING);
    assert!(
        js.contains(&expected),
        "rust/src/bdd_generated.rs is out of sync with the JavaScript BDD"
    );
}

#[test]
fn packed_bdd_only_references_known_states_and_actions() {
    let n = PACKED_BDD.len() / 3;
    assert_eq!(PACKED_BDD.len() % 3, 0);
    for node in PACKED_BDD.chunks(3) {
        assert!((node[0] as usize) < ORDERED_STATE_LIST.len());
        for &reference in &node[1..] {
            let reference = reference as usize;
            assert!(reference < n || reference - n < ORDERED_ACTION_LIST.len());
        }
    }
}

#[test]
fn insert_into_empty_results_without_limit() {
    let params = query_params(10, None, None);
    let event = insert(human("a", 20));
    let action = calculate_action_name(&StateResolveFunctionInput {
        query_params: &params,
        change_event: &event,
        previous_results: &[],
        key_document_map: None,
    });
    assert_eq!(action, ActionName::InsertFirst);
}

#[test]
fn insert_of_non_matching_document_does_nothing() {
    let params = query_params(10, None, None);
    let event = insert(human("a", 5));
    let results = vec![human("b", 20)];
    let action = calculate_action_name(&StateResolveFunctionInput {
        query_params: &params,
        change_event: &event,
        previous_results: &results,
        key_document_map: None,
    });
    assert_eq!(action, ActionName::DoNothing);
}
