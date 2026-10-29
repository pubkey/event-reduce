//! Runs the test suite that all implementations share, see ../test-suite/README.md.

use std::collections::HashMap;

use rxdb_event_reduce::*;
use serde_json::{json, Value};

#[derive(Clone, Debug, PartialEq)]
struct Doc {
    id: String,
    age: i64,
    name: String,
}

fn load(file: &str) -> Value {
    let path = format!("{}/../test-suite/{}", env!("CARGO_MANIFEST_DIR"), file);
    serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap()
}

fn doc(value: &Value) -> Doc {
    Doc {
        id: value["id"].as_str().unwrap().to_string(),
        age: value["age"].as_i64().unwrap(),
        name: value["name"].as_str().unwrap_or("").to_string(),
    }
}

fn docs(value: &Value) -> Vec<Doc> {
    value.as_array().unwrap().iter().map(doc).collect()
}

fn ids(docs: &[Doc]) -> Value {
    json!(docs.iter().map(|d| d.id.clone()).collect::<Vec<_>>())
}

fn query_params(query: &Value) -> QueryParams<Doc, String> {
    let min_age = query["minAge"].as_i64().unwrap();
    let desc = query["desc"].as_bool().unwrap_or(false);
    QueryParams {
        get_document_id: |d| &d.id,
        skip: query["skip"].as_u64().map(|v| v as usize),
        limit: query["limit"].as_u64().map(|v| v as usize),
        query_matcher: Box::new(move |d| d.age > min_age),
        sort_comparator: Box::new(move |a, b| {
            let ordering = a.age.cmp(&b.age).then_with(|| a.id.cmp(&b.id));
            if desc {
                ordering.reverse()
            } else {
                ordering
            }
        }),
        sort_fields_changed: Box::new(|previous, doc| previous.age != doc.age),
    }
}

fn change_event(value: &Value) -> ChangeEvent<Doc, String> {
    let id = value["id"].as_str().unwrap().to_string();
    match value["operation"].as_str().unwrap() {
        "INSERT" => ChangeEvent::Insert {
            id,
            doc: doc(&value["doc"]),
        },
        "UPDATE" => ChangeEvent::Update {
            id,
            doc: doc(&value["doc"]),
            previous: doc(&value["previous"]),
        },
        _ => ChangeEvent::Delete {
            id,
            previous: doc(&value["previous"]),
        },
    }
}

fn error_code(error: EventReduceError) -> String {
    error
        .to_string()
        .trim_start_matches("EventReduce:")
        .to_string()
}

fn action_by_name(name: &str) -> ActionName {
    *ORDERED_ACTION_LIST
        .iter()
        .find(|a| a.as_str() == name)
        .unwrap()
}

fn buffer_size(value: &Value) -> usize {
    if value == "all" {
        RESULT_WINDOW_BUFFER_ALL_ROWS
    } else {
        value.as_u64().unwrap() as usize
    }
}

#[test]
fn state_sets() {
    let suite = load("state-sets.json");
    let packed_bdd: Vec<u16> = suite["packedBdd"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_u64().unwrap() as u16)
        .collect();
    assert_eq!(
        packed_bdd, PACKED_BDD,
        "bdd_generated.rs is out of sync with the JavaScript BDD"
    );
    for (index, case) in suite["cases"].as_array().unwrap().iter().enumerate() {
        let query_params = query_params(&case["query"]);
        let change_event = change_event(&case["changeEvent"]);
        let previous_results = docs(&case["previousResults"]);
        let input = StateResolveFunctionInput {
            query_params: &query_params,
            change_event: &change_event,
            previous_results: &previous_results,
            key_document_map: None,
        };
        assert_eq!(
            get_state_set(&input),
            case["stateSet"],
            "state set of case #{}",
            index
        );
        assert_eq!(
            calculate_action_name(&input).as_str(),
            case["action"],
            "action of case #{}",
            index
        );
    }
}

#[test]
fn actions() {
    for case in load("cases.json")["actions"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let query_params = query_params(&case["query"]);
        let change_event = change_event(&case["changeEvent"]);
        let mut results = docs(&case["previousResults"]);
        let mut key_document_map: Option<HashMap<String, Doc>> = case["useKeyDocumentMap"]
            .as_bool()
            .unwrap()
            .then(|| results.iter().map(|d| (d.id.clone(), d.clone())).collect());
        let action = match case["action"].as_str() {
            Some(action) => action_by_name(action),
            None => {
                let action = calculate_action_name(&StateResolveFunctionInput {
                    query_params: &query_params,
                    change_event: &change_event,
                    previous_results: &results,
                    key_document_map: key_document_map.as_ref(),
                });
                assert_eq!(action.as_str(), case["expectedAction"], "{}", name);
                action
            }
        };
        let error = run_action(
            action,
            &query_params,
            &change_event,
            &mut results,
            key_document_map.as_mut(),
        )
        .err()
        .map(error_code);
        assert_eq!(error.as_deref(), case["expectedError"].as_str(), "{}", name);
        assert_eq!(results, docs(&case["expectedResults"]), "{}", name);
        if let Some(map) = key_document_map {
            let mut map_docs: Vec<Doc> = map.into_values().collect();
            map_docs.sort_by(|a, b| a.id.cmp(&b.id));
            assert_eq!(map_docs, docs(&case["expectedKeyDocumentMap"]), "{}", name);
        }
    }
}

#[test]
fn result_window_buffer() {
    for scenario in load("cases.json")["resultWindowBuffer"].as_array().unwrap() {
        let name = scenario["name"].as_str().unwrap();
        let mut buffer = ResultWindowBuffer::new(
            query_params(&scenario["query"]),
            ResultWindowBufferSizes {
                limit_buffer_size: buffer_size(&scenario["limitBufferSize"]),
                skip_buffer_size: buffer_size(&scenario["skipBufferSize"]),
            },
        );
        for (index, step) in scenario["steps"].as_array().unwrap().iter().enumerate() {
            let op = step["op"].as_str().unwrap();
            let context = format!("{}: step #{} {}", name, index, op);
            match op {
                "query" => {
                    let query = buffer.query();
                    assert_eq!(
                        json!({ "skip": query.skip, "limit": query.limit }),
                        step["expected"],
                        "{}",
                        context
                    );
                }
                "reset" => buffer.reset(docs(&step["rows"])),
                "results" => match buffer.results() {
                    Ok(results) => assert_eq!(ids(results), step["expected"], "{}", context),
                    Err(error) => {
                        assert_eq!(error_code(error), step["expectedError"], "{}", context)
                    }
                },
                "applyChangeEvent" => {
                    let result = buffer
                        .apply_change_event(&change_event(&step["changeEvent"]))
                        .as_str();
                    assert_eq!(result, step["expected"], "{}", context);
                }
                "applyChangeEvents" => {
                    let change_events: Vec<_> = step["changeEvents"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .map(change_event)
                        .collect();
                    let actual = match buffer.apply_change_events(&change_events) {
                        ResultWindowBufferChangeResult::RunFullQueryAgain => {
                            json!({ "runFullQueryAgain": true })
                        }
                        ResultWindowBufferChangeResult::Results { changed, results } => {
                            json!({ "runFullQueryAgain": false, "changed": changed, "results": ids(&results) })
                        }
                    };
                    assert_eq!(actual, step["expected"], "{}", context);
                }
                "inspect" => {
                    let actual = json!({
                        "buffer": ids(buffer.buffer()),
                        "offset": buffer.offset(),
                        "complete": buffer.is_complete(),
                    });
                    assert_eq!(actual, step["expected"], "{}", context);
                }
                _ => panic!("{}: unknown op", context),
            }
        }
    }
}

#[test]
fn recommended_result_window_buffer_size() {
    for pair in load("cases.json")["recommendedResultWindowBufferSize"]
        .as_array()
        .unwrap()
    {
        let limit = pair[0].as_u64().map(|v| v as usize);
        assert_eq!(
            get_recommended_result_window_buffer_size(limit) as u64,
            pair[1].as_u64().unwrap(),
            "limit {:?}",
            limit
        );
    }
}
