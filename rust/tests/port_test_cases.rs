//! Runs the test cases that the JavaScript implementation created,
//! see javascript/test/helper/port-test-cases.ts.
//! This implementation only resolves the BDD that was created there,
//! so it must calculate the same state set and action for every case.

use event_reduce::*;
use serde_json::Value;

#[derive(Clone, Debug, PartialEq)]
struct Doc {
    id: String,
    age: i64,
}

fn doc(value: &Value) -> Option<Doc> {
    if value.is_null() {
        return None;
    }
    Some(Doc {
        id: value["id"].as_str().unwrap().to_string(),
        age: value["age"].as_i64().unwrap(),
    })
}

/// The query of the test cases: age > minAge, sorted by age, then by id.
fn query_params(query: &Value) -> QueryParams<Doc, String> {
    let min_age = query["minAge"].as_i64().unwrap();
    QueryParams {
        get_document_id: |d| &d.id,
        skip: query["skip"].as_u64().map(|v| v as usize),
        limit: query["limit"].as_u64().map(|v| v as usize),
        query_matcher: Box::new(move |d| d.age > min_age),
        sort_comparator: Box::new(|a, b| a.age.cmp(&b.age).then_with(|| a.id.cmp(&b.id))),
        sort_fields_changed: Box::new(|prev, doc| prev.age != doc.age),
    }
}

fn change_event(value: &Value) -> ChangeEvent<Doc, String> {
    let id = value["id"].as_str().unwrap().to_string();
    match value["operation"].as_str().unwrap() {
        "INSERT" => ChangeEvent::Insert {
            id,
            doc: doc(&value["doc"]).unwrap(),
        },
        "UPDATE" => ChangeEvent::Update {
            id,
            doc: doc(&value["doc"]).unwrap(),
            previous: doc(&value["previous"]).unwrap(),
        },
        _ => ChangeEvent::Delete {
            id,
            previous: doc(&value["previous"]).unwrap(),
        },
    }
}

#[test]
fn same_state_set_and_action_as_the_javascript_implementation() {
    let json = include_str!("../../javascript/test/fixtures/port-test-cases.json");
    let cases: Vec<Value> = serde_json::from_str(json).unwrap();
    assert!(cases.len() > 100);
    for (index, case) in cases.iter().enumerate() {
        let query_params = query_params(&case["query"]);
        let change_event = change_event(&case["changeEvent"]);
        let previous_results: Vec<Doc> = case["previousResults"]
            .as_array()
            .unwrap()
            .iter()
            .map(|d| doc(d).unwrap())
            .collect();
        let input = StateResolveFunctionInput {
            query_params: &query_params,
            change_event: &change_event,
            previous_results: &previous_results,
            key_document_map: None,
        };
        assert_eq!(
            get_state_set(&input),
            case["stateSet"].as_str().unwrap(),
            "state set of case #{}",
            index
        );
        assert_eq!(
            calculate_action_name(&input).as_str(),
            case["action"].as_str().unwrap(),
            "action of case #{}",
            index
        );
    }
}
