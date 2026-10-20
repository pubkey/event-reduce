use std::collections::HashMap;

use event_reduce::*;

mod common;
use common::*;

fn resolve(
    state: StateName,
    params: &QueryParams<Human, String>,
    event: &ChangeEvent<Human, String>,
    results: &[Human],
) -> bool {
    resolve_state(
        state,
        &StateResolveFunctionInput {
            query_params: params,
            change_event: event,
            previous_results: results,
            key_document_map: None,
        },
    )
}

#[test]
fn state_names_match_the_javascript_order() {
    let names: Vec<&str> = ORDERED_STATE_LIST.iter().map(|s| s.as_str()).collect();
    assert_eq!(
        names,
        vec![
            "isInsert",
            "isUpdate",
            "isDelete",
            "hasLimit",
            "isFindOne",
            "hasSkip",
            "wasResultsEmpty",
            "wasLimitReached",
            "wasFirst",
            "wasLast",
            "sortParamsChanged",
            "wasInResult",
            "wasSortedBeforeFirst",
            "wasSortedAfterLast",
            "isSortedBeforeFirst",
            "isSortedAfterLast",
            "wasMatching",
            "doesMatchNow"
        ]
    );
}

#[test]
fn limit_and_skip() {
    let event = insert(human("a", 20));
    let params = query_params(0, Some(2), Some(1));
    assert!(resolve(StateName::HasLimit, &params, &event, &[]));
    assert!(resolve(StateName::IsFindOne, &params, &event, &[]));
    assert!(resolve(StateName::HasSkip, &params, &event, &[]));
    assert!(resolve(
        StateName::WasLimitReached,
        &params,
        &event,
        &[human("b", 1)]
    ));
    let params = query_params(0, Some(0), None);
    assert!(!resolve(StateName::HasLimit, &params, &event, &[]));
    assert!(!resolve(StateName::IsFindOne, &params, &event, &[]));
    assert!(!resolve(StateName::HasSkip, &params, &event, &[]));
    assert!(!resolve(
        StateName::WasLimitReached,
        &params,
        &event,
        &[human("b", 1)]
    ));
}

#[test]
fn operations() {
    let params = query_params(0, None, None);
    let event = delete(human("a", 1));
    assert!(resolve(StateName::IsDelete, &params, &event, &[]));
    assert!(!resolve(StateName::IsInsert, &params, &event, &[]));
    assert!(!resolve(StateName::IsUpdate, &params, &event, &[]));
}

#[test]
fn sort_params_changed() {
    let params = query_params(0, None, None);
    let mut renamed = human("a", 1);
    renamed.name = "other".to_string();
    assert!(!resolve(
        StateName::SortParamsChanged,
        &params,
        &update(human("a", 1), renamed),
        &[]
    ));
    assert!(resolve(
        StateName::SortParamsChanged,
        &params,
        &update(human("a", 1), human("a", 2)),
        &[]
    ));
    assert!(resolve(
        StateName::SortParamsChanged,
        &params,
        &insert(human("a", 1)),
        &[]
    ));
    assert!(!resolve(
        StateName::SortParamsChanged,
        &params,
        &delete(human("a", 1)),
        &[]
    ));
}

#[test]
fn was_in_result_with_and_without_map() {
    let params = query_params(0, None, None);
    let event = update(human("b", 1), human("b", 2));
    let results = vec![human("a", 1), human("b", 1)];
    assert!(resolve(StateName::WasInResult, &params, &event, &results));
    assert!(!resolve(
        StateName::WasInResult,
        &params,
        &event,
        &results[..1]
    ));
    let map: HashMap<String, Human> = results.iter().map(|d| (d.id.clone(), d.clone())).collect();
    assert!(was_in_result(&StateResolveFunctionInput {
        query_params: &params,
        change_event: &event,
        previous_results: &results,
        key_document_map: Some(&map),
    }));
}

#[test]
fn first_and_last() {
    let params = query_params(0, None, None);
    let results = vec![human("a", 1), human("b", 5), human("c", 10)];
    let event = update(human("a", 1), human("a", 20));
    assert!(resolve(StateName::WasFirst, &params, &event, &results));
    assert!(!resolve(StateName::WasLast, &params, &event, &results));
    // the changed document is the first one, so it must be true
    assert!(resolve(
        StateName::WasSortedBeforeFirst,
        &params,
        &event,
        &results
    ));
    assert!(!resolve(
        StateName::WasSortedAfterLast,
        &params,
        &event,
        &results
    ));
    assert!(resolve(
        StateName::IsSortedAfterLast,
        &params,
        &event,
        &results
    ));
    let event = insert(human("d", 0));
    assert!(resolve(
        StateName::IsSortedBeforeFirst,
        &params,
        &event,
        &results
    ));
    assert!(!resolve(
        StateName::IsSortedAfterLast,
        &params,
        &event,
        &results
    ));
    assert!(!resolve(
        StateName::WasSortedBeforeFirst,
        &params,
        &event,
        &results
    ));
    assert!(!resolve(
        StateName::IsSortedBeforeFirst,
        &params,
        &event,
        &[]
    ));
}

#[test]
fn matching() {
    let params = query_params(10, None, None);
    let event = update(human("a", 5), human("a", 20));
    assert!(!resolve(StateName::WasMatching, &params, &event, &[]));
    assert!(resolve(StateName::DoesMatchNow, &params, &event, &[]));
    assert!(resolve(StateName::WasResultsEmpty, &params, &event, &[]));
}

#[test]
fn state_set() {
    let params = query_params(0, None, None);
    let set = get_state_set(&StateResolveFunctionInput {
        query_params: &params,
        change_event: &insert(human("a", 1)),
        previous_results: &[],
        key_document_map: None,
    });
    assert_eq!(set, "100000100010000001");
}
