use std::collections::HashMap;

use event_reduce::*;

mod common;
use common::*;

fn ids(results: &[Human]) -> Vec<&str> {
    results.iter().map(|d| d.id.as_str()).collect()
}

#[test]
fn action_names_match_the_javascript_order() {
    let names: Vec<&str> = ORDERED_ACTION_LIST.iter().map(|a| a.as_str()).collect();
    assert_eq!(
        names,
        vec![
            "doNothing",
            "insertFirst",
            "insertLast",
            "removeFirstItem",
            "removeLastItem",
            "removeFirstInsertLast",
            "removeLastInsertFirst",
            "removeFirstInsertFirst",
            "removeLastInsertLast",
            "removeExisting",
            "replaceExisting",
            "alwaysWrong",
            "insertAtSortPosition",
            "removeExistingAndInsertAtSortPosition",
            "insertAtSortPositionRemoveLast",
            "insertAtSortPositionRemoveFirst",
            "runFullQueryAgain",
            "unknownAction"
        ]
    );
}

#[test]
fn all_actions_do_not_panic_on_any_input() {
    let params = query_params(0, None, Some(3));
    let events = vec![
        insert(human("x", 3)),
        update(human("b", 2), human("b", 7)),
        delete(human("b", 2)),
    ];
    for action in ORDERED_ACTION_LIST {
        for event in &events {
            for results in [vec![], vec![human("a", 1), human("b", 2), human("c", 3)]] {
                let mut results = results;
                let mut map: HashMap<String, Human> =
                    results.iter().map(|d| (d.id.clone(), d.clone())).collect();
                let _ = run_action(action, &params, event, &mut results, Some(&mut map));
                let _ = run_action(action, &params, event, &mut results, None);
            }
        }
    }
}

#[test]
fn run_full_query_again_returns_an_error() {
    let params = query_params(0, None, None);
    let mut results = vec![human("a", 1)];
    let result = run_action(
        ActionName::RunFullQueryAgain,
        &params,
        &insert(human("b", 1)),
        &mut results,
        None,
    );
    assert_eq!(result, Err(EventReduceError::RunFullQueryAgain));
    let result = run_action(
        ActionName::AlwaysWrong,
        &params,
        &insert(human("b", 1)),
        &mut results,
        None,
    );
    assert_eq!(result, Err(EventReduceError::UnknownAction));
    assert_eq!(ids(&results), vec!["a"]);
}

#[test]
fn remove_existing_from_the_middle_keeps_the_map_in_sync() {
    let params = query_params(0, None, None);
    let mut results = vec![human("a", 1), human("b", 2), human("c", 3)];
    let mut map: HashMap<String, Human> =
        results.iter().map(|d| (d.id.clone(), d.clone())).collect();
    run_action(
        ActionName::RemoveExisting,
        &params,
        &delete(human("b", 2)),
        &mut results,
        Some(&mut map),
    )
    .unwrap();
    assert_eq!(ids(&results), vec!["a", "c"]);
    assert!(!map.contains_key("b"));
    assert_eq!(map.len(), 2);
}

#[test]
fn replace_existing_at_the_same_position() {
    let params = query_params(0, None, None);
    let mut results = vec![human("a", 1), human("b", 2), human("c", 3)];
    let mut renamed = human("b", 2);
    renamed.name = "new".to_string();
    let mut map: HashMap<String, Human> =
        results.iter().map(|d| (d.id.clone(), d.clone())).collect();
    run_action(
        ActionName::ReplaceExisting,
        &params,
        &update(human("b", 2), renamed.clone()),
        &mut results,
        Some(&mut map),
    )
    .unwrap();
    assert_eq!(results[1], renamed);
    assert_eq!(map["b"], renamed);
}

#[test]
fn insert_at_sort_position() {
    let params = query_params(0, None, None);
    let mut results = vec![];
    run_action(
        ActionName::InsertAtSortPosition,
        &params,
        &insert(human("b", 5)),
        &mut results,
        None,
    )
    .unwrap();
    run_action(
        ActionName::InsertAtSortPosition,
        &params,
        &insert(human("d", 9)),
        &mut results,
        None,
    )
    .unwrap();
    run_action(
        ActionName::InsertAtSortPosition,
        &params,
        &insert(human("a", 5)),
        &mut results,
        None,
    )
    .unwrap();
    run_action(
        ActionName::InsertAtSortPosition,
        &params,
        &insert(human("c", 7)),
        &mut results,
        None,
    )
    .unwrap();
    assert_eq!(ids(&results), vec!["a", "b", "c", "d"]);
    // inserting a document that is already in the results does nothing
    run_action(
        ActionName::InsertAtSortPosition,
        &params,
        &insert(human("c", 7)),
        &mut results,
        None,
    )
    .unwrap();
    assert_eq!(ids(&results), vec!["a", "b", "c", "d"]);
}

#[test]
fn remove_first_insert_last_with_map() {
    let params = query_params(0, None, Some(2));
    let mut results = vec![human("a", 1), human("b", 2)];
    let mut map: HashMap<String, Human> =
        results.iter().map(|d| (d.id.clone(), d.clone())).collect();
    run_action(
        ActionName::RemoveFirstInsertLast,
        &params,
        &insert(human("c", 3)),
        &mut results,
        Some(&mut map),
    )
    .unwrap();
    assert_eq!(ids(&results), vec!["b", "c"]);
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();
    assert_eq!(keys, vec!["b", "c"]);
}

#[test]
fn insert_at_sort_position_remove_last_and_first() {
    let params = query_params(0, None, Some(3));
    let mut results = vec![human("a", 1), human("c", 3), human("e", 5)];
    let mut map: HashMap<String, Human> =
        results.iter().map(|d| (d.id.clone(), d.clone())).collect();
    run_action(
        ActionName::InsertAtSortPositionRemoveLast,
        &params,
        &insert(human("b", 2)),
        &mut results,
        Some(&mut map),
    )
    .unwrap();
    assert_eq!(ids(&results), vec!["a", "b", "c"]);
    run_action(
        ActionName::InsertAtSortPositionRemoveFirst,
        &params,
        &insert(human("d", 4)),
        &mut results,
        Some(&mut map),
    )
    .unwrap();
    assert_eq!(ids(&results), vec!["b", "c", "d"]);
    let mut keys: Vec<&String> = map.keys().collect();
    keys.sort();
    assert_eq!(keys, vec!["b", "c", "d"]);
    // a document that is already in the results is not inserted, so nothing is removed
    run_action(
        ActionName::InsertAtSortPositionRemoveLast,
        &params,
        &insert(human("c", 3)),
        &mut results,
        None,
    )
    .unwrap();
    assert_eq!(ids(&results), vec!["b", "c", "d"]);
}
