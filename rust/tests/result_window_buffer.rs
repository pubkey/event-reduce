//! Port of javascript/test/unit/result-window-buffer.test.ts
//! After every event, the visible result must equal the full query,
//! and the buffer must be an exact slice of the full result.

use std::collections::{BTreeMap, HashMap};

use event_reduce::*;

#[derive(Clone, Debug, PartialEq)]
struct Doc {
    id: String,
    female: bool,
    age: u32,
}

fn doc(id: &str, age: u32) -> Doc {
    Doc {
        id: id.to_string(),
        female: true,
        age,
    }
}

#[derive(Clone, Copy)]
struct TestQuery {
    asc: bool,
    skip: Option<usize>,
    limit: Option<usize>,
}

const fn q(asc: bool, skip: Option<usize>, limit: Option<usize>) -> TestQuery {
    TestQuery { asc, skip, limit }
}

const QUERIES: [TestQuery; 8] = [
    q(true, None, Some(20)),
    q(false, None, Some(20)),
    q(true, Some(10), Some(20)),
    q(false, Some(10), Some(20)),
    q(true, None, Some(1)),
    q(false, Some(3), Some(5)),
    // skip without limit
    q(true, Some(5), None),
    // neither skip nor limit
    q(true, None, None),
];

const ALL: usize = RESULT_WINDOW_BUFFER_ALL_ROWS;
const BUFFER_SIZES: [(usize, usize); 6] = [(0, 0), (5, 0), (0, 5), (20, 3), (50, 20), (ALL, ALL)];
const INITIAL_ROWS: [usize; 3] = [0, 30, 300];
const EVENTS_PER_RUN: usize = 600;

fn sizes(limit_buffer_size: usize, skip_buffer_size: usize) -> ResultWindowBufferSizes {
    ResultWindowBufferSizes {
        limit_buffer_size,
        skip_buffer_size,
    }
}

/// The query is always: female, sorted by age, then by id.
/// Age has only 100 different values, so many rows have the same age
/// and the id decides their order.
fn query_params(query: TestQuery) -> QueryParams<Doc, String> {
    let asc = query.asc;
    QueryParams {
        get_document_id: |d| &d.id,
        skip: query.skip,
        limit: query.limit,
        query_matcher: Box::new(|d| d.female),
        sort_comparator: Box::new(move |a, b| {
            let ordering = a.age.cmp(&b.age).then_with(|| a.id.cmp(&b.id));
            if asc {
                ordering
            } else {
                ordering.reverse()
            }
        }),
        sort_fields_changed: Box::new(|prev, doc| prev.age != doc.age),
    }
}

fn buffer_of(
    query: TestQuery,
    limit_buffer_size: usize,
    skip_buffer_size: usize,
) -> ResultWindowBuffer<Doc, String> {
    ResultWindowBuffer::new(
        query_params(query),
        sizes(limit_buffer_size, skip_buffer_size),
    )
}

/// Full query over all documents: filter, sort, skip, limit.
fn run_query(
    docs: &BTreeMap<String, Doc>,
    params: &QueryParams<Doc, String>,
    skip: usize,
    limit: Option<usize>,
) -> Vec<Doc> {
    let mut all: Vec<Doc> = docs
        .values()
        .filter(|d| (params.query_matcher)(d))
        .cloned()
        .collect();
    all.sort_by(|a, b| (params.sort_comparator)(a, b));
    let start = skip.min(all.len());
    let end = limit.map_or(all.len(), |l| (start + l).min(all.len()));
    all[start..end].to_vec()
}

fn fill(buffer: &mut ResultWindowBuffer<Doc, String>, docs: &BTreeMap<String, Doc>) {
    let query = buffer.query();
    let rows = run_query(docs, buffer.query_params(), query.skip, query.limit);
    buffer.reset(rows);
}

fn ids(docs: &[Doc]) -> String {
    docs.iter()
        .map(|d| d.id.as_str())
        .collect::<Vec<_>>()
        .join(",")
}

fn results(buffer: &ResultWindowBuffer<Doc, String>) -> String {
    ids(buffer.results().unwrap())
}

/// Seeded random numbers (xorshift), so that every run produces the same events.
struct Random(u64);

impl Random {
    fn new(seed: u64) -> Self {
        Random(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1)
    }
    fn next(&mut self) -> f64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 >> 11) as f64 / (1u64 << 53) as f64
    }
    fn int(&mut self, min: u32, max: u32) -> u32 {
        min + (self.next() * (max - min + 1) as f64) as u32
    }
}

#[derive(Clone, Copy)]
struct Weights {
    insert: f64,
    update: f64,
    delete: f64,
}

const ONLY_INSERTS: Weights = Weights {
    insert: 1.0,
    update: 0.0,
    delete: 0.0,
};

/// First more inserts, then mostly updates, then more deletes,
/// so that the result grows, moves around and shrinks to (almost) nothing.
fn weights(event_index: usize) -> Weights {
    let phase = event_index as f64 / EVENTS_PER_RUN as f64;
    let (insert, update, delete) = if phase < 0.4 {
        (3.0, 5.0, 1.0)
    } else if phase < 0.7 {
        (1.0, 8.0, 1.0)
    } else {
        (1.0, 3.0, 5.0)
    };
    Weights {
        insert,
        update,
        delete,
    }
}

fn random_change_event(
    docs: &BTreeMap<String, Doc>,
    random: &mut Random,
    new_id: &mut impl FnMut(&mut Random) -> String,
    weights: Weights,
) -> ChangeEvent<Doc, String> {
    let total = weights.insert + weights.update + weights.delete;
    let mut r = random.next() * total;
    if docs.is_empty() || r < weights.insert {
        let doc = Doc {
            id: new_id(random),
            female: random.next() < 0.5,
            age: random.int(1, 100),
        };
        return ChangeEvent::Insert {
            id: doc.id.clone(),
            doc,
        };
    }
    r -= weights.insert;
    let all: Vec<&Doc> = docs.values().collect();
    let previous = all[random.int(0, all.len() as u32 - 1) as usize].clone();
    if r < weights.update {
        let mut doc = previous.clone();
        if random.next() < 0.5 {
            // starts or stops matching
            doc.female = !doc.female;
        } else {
            // moves in the sort order
            doc.age = random.int(1, 100);
        }
        return ChangeEvent::Update {
            id: doc.id.clone(),
            doc,
            previous,
        };
    }
    ChangeEvent::Delete {
        id: previous.id.clone(),
        previous,
    }
}

fn apply_to_docs(docs: &mut BTreeMap<String, Doc>, change_event: &ChangeEvent<Doc, String>) {
    match change_event.doc() {
        Some(doc) => docs.insert(doc.id.clone(), doc.clone()),
        None => docs.remove(change_event.id()),
    };
}

fn counter_ids() -> impl FnMut(&mut Random) -> String {
    let mut counter = 0;
    move |_| {
        counter += 1;
        format!("id-{:05}", counter)
    }
}

#[test]
fn recommended_size_for_each_limit() {
    let expected = [
        (None, 0),
        (Some(0), 0),
        (Some(1), 0),
        (Some(2), 1),
        (Some(3), 1),
        (Some(4), 2),
        (Some(10), 3),
        (Some(20), 4),
        (Some(100), 7),
        (Some(200), 11),
        (Some(500), 20),
        (Some(1000), 26),
        (Some(2711), 29),
        (Some(2712), 30),
        (Some(100000), 30),
    ];
    for (limit, size) in expected {
        assert_eq!(
            get_recommended_result_window_buffer_size(limit),
            size,
            "limit {:?}",
            limit
        );
    }
}

#[test]
fn query_adds_the_buffer_sizes_to_the_skip_and_limit() {
    let buffer = buffer_of(q(true, Some(10), Some(20)), 5, 3);
    assert_eq!(
        buffer.query(),
        ResultWindowBufferQuery {
            skip: 7,
            limit: Some(28)
        }
    );
    // not below skip 0
    let buffer = buffer_of(q(true, Some(2), Some(20)), 0, 5);
    assert_eq!(
        buffer.query(),
        ResultWindowBufferQuery {
            skip: 0,
            limit: Some(22)
        }
    );
    // not set means 0
    let buffer = buffer_of(q(true, Some(10), Some(20)), 0, 0);
    assert_eq!(
        buffer.query(),
        ResultWindowBufferQuery {
            skip: 10,
            limit: Some(20)
        }
    );
    // all rows
    let buffer = buffer_of(q(true, Some(10), Some(20)), ALL, ALL);
    assert_eq!(
        buffer.query(),
        ResultWindowBufferQuery {
            skip: 0,
            limit: None
        }
    );
    let buffer = buffer_of(q(true, Some(10), Some(20)), ALL, 0);
    assert_eq!(
        buffer.query(),
        ResultWindowBufferQuery {
            skip: 10,
            limit: None
        }
    );
    // no limit for a query without a limit
    let buffer = buffer_of(q(true, Some(10), None), 5, 3);
    assert_eq!(
        buffer.query(),
        ResultWindowBufferQuery {
            skip: 7,
            limit: None
        }
    );
}

#[test]
fn reset() {
    // asks for a full query and has no results before it got rows
    let mut buffer = buffer_of(q(true, None, Some(2)), 0, 0);
    assert_eq!(
        buffer.results(),
        Err(EventReduceError::ResultWindowOutdated)
    );
    let event = ChangeEvent::Insert {
        id: "a".to_string(),
        doc: doc("a", 1),
    };
    assert_eq!(
        buffer.apply_change_event(&event),
        ResultWindowBufferResult::RunFullQueryAgain
    );

    // complete when the query returned fewer rows than requested
    let mut buffer = buffer_of(q(true, None, Some(2)), 2, 0);
    buffer.reset(vec![doc("a", 1), doc("b", 2), doc("c", 3)]);
    assert!(buffer.is_complete());
    assert_eq!(results(&buffer), "a,b");

    // not complete when the query returned as many rows as requested
    let mut buffer = buffer_of(q(true, None, Some(1)), 1, 0);
    buffer.reset(vec![doc("a", 1), doc("b", 2)]);
    assert!(!buffer.is_complete());

    // shows the rows after the skipped rows of the buffer
    let mut buffer = buffer_of(q(true, Some(1), Some(2)), 0, 1);
    buffer.reset(vec![doc("a", 1), doc("b", 2), doc("c", 3)]);
    assert_eq!(buffer.offset(), 0);
    assert_eq!(results(&buffer), "b,c");
}

#[test]
fn refills_the_window_from_the_buffer_when_a_visible_row_is_deleted() {
    let mut buffer = buffer_of(q(true, None, Some(2)), 2, 0);
    buffer.reset(vec![doc("a", 1), doc("b", 2), doc("c", 3), doc("d", 4)]);
    let event = ChangeEvent::Delete {
        id: "a".to_string(),
        previous: doc("a", 1),
    };
    assert_eq!(
        buffer.apply_change_event(&event),
        ResultWindowBufferResult::Buffer
    );
    assert_eq!(results(&buffer), "b,c");
    assert_eq!(ids(buffer.buffer()), "b,c,d");
}

#[test]
fn does_not_append_a_row_that_moves_behind_the_last_row_of_the_buffer() {
    let mut buffer = buffer_of(q(true, None, Some(2)), 1, 0);
    buffer.reset(vec![doc("a", 1), doc("b", 2), doc("c", 3)]);
    let event = ChangeEvent::Update {
        id: "a".to_string(),
        doc: doc("a", 99),
        previous: doc("a", 1),
    };
    assert_eq!(
        buffer.apply_change_event(&event),
        ResultWindowBufferResult::Buffer
    );
    assert_eq!(ids(buffer.buffer()), "b,c");
}

#[test]
fn asks_for_a_full_query_when_a_row_is_added_in_front_of_the_skip_window_without_a_skip_buffer() {
    let mut buffer = buffer_of(q(true, Some(1), Some(1)), 1, 0);
    buffer.reset(vec![doc("b", 2), doc("c", 3)]);
    let event = ChangeEvent::Insert {
        id: "x".to_string(),
        doc: doc("x", 0),
    };
    assert_eq!(
        buffer.apply_change_event(&event),
        ResultWindowBufferResult::RunFullQueryAgain
    );
    // the results are outdated until the query runs again
    assert_eq!(
        buffer.results(),
        Err(EventReduceError::ResultWindowOutdated)
    );
}

#[test]
fn takes_the_row_from_the_skip_buffer_when_a_row_is_added_in_front_of_the_window() {
    let mut buffer = buffer_of(q(true, Some(2), Some(1)), 0, 1);
    // skip 1, limit 2: 'a' is skipped and not in the buffer
    buffer.reset(vec![doc("b", 2), doc("c", 3)]);
    assert_eq!(results(&buffer), "c");
    let event = ChangeEvent::Insert {
        id: "x".to_string(),
        doc: doc("x", 0),
    };
    assert_eq!(
        buffer.apply_change_event(&event),
        ResultWindowBufferResult::Buffer
    );
    assert_eq!(buffer.offset(), 2);
    assert_eq!(results(&buffer), "b");
}

#[test]
fn returns_no_rows_for_a_query_with_limit_0() {
    let mut random = Random::new(77);
    let mut new_id = counter_ids();
    for skip in [None, Some(2)] {
        let mut docs = BTreeMap::new();
        for _ in 0..10 {
            let event = random_change_event(&docs, &mut random, &mut new_id, ONLY_INSERTS);
            apply_to_docs(&mut docs, &event);
        }
        let mut buffer = buffer_of(q(true, skip, Some(0)), 2, 2);
        fill(&mut buffer, &docs);
        // no rows are kept, so the buffer query asks for none
        assert_eq!(
            buffer.query(),
            ResultWindowBufferQuery {
                skip: skip.unwrap_or(0),
                limit: Some(0)
            }
        );
        assert_eq!(results(&buffer), "");
        for i in 0..100 {
            let event = random_change_event(&docs, &mut random, &mut new_id, weights(i));
            apply_to_docs(&mut docs, &event);
            assert_eq!(
                buffer.apply_change_event(&event),
                ResultWindowBufferResult::EventReduce
            );
            assert_eq!(results(&buffer), "");
            assert!(buffer.buffer().is_empty());
        }
    }
}

#[test]
fn handles_a_query_with_a_skip_but_without_a_limit() {
    let mut buffer = buffer_of(q(true, Some(1), None), 0, 1);
    buffer.reset(vec![doc("a", 1), doc("b", 2), doc("c", 3)]);
    assert_eq!(results(&buffer), "b,c");
    let event = ChangeEvent::Insert {
        id: "x".to_string(),
        doc: doc("x", 0),
    };
    assert_ne!(
        buffer.apply_change_event(&event),
        ResultWindowBufferResult::RunFullQueryAgain
    );
    assert_eq!(results(&buffer), "a,b,c");
}

#[test]
fn apply_change_events_returns_the_new_results_and_if_they_changed() {
    let mut buffer = buffer_of(q(true, None, Some(2)), 3, 0);
    buffer.reset(vec![
        doc("a", 1),
        doc("b", 2),
        doc("c", 3),
        doc("d", 4),
        doc("e", 5),
    ]);
    // a row after the result window changes
    let not_visible = buffer.apply_change_events(&[ChangeEvent::Update {
        id: "e".to_string(),
        doc: doc("e", 6),
        previous: doc("e", 5),
    }]);
    assert!(matches!(
        not_visible,
        ResultWindowBufferChangeResult::Results { changed: false, .. }
    ));

    let visible = buffer.apply_change_events(&[
        ChangeEvent::Delete {
            id: "a".to_string(),
            previous: doc("a", 1),
        },
        ChangeEvent::Delete {
            id: "b".to_string(),
            previous: doc("b", 2),
        },
    ]);
    match visible {
        ResultWindowBufferChangeResult::Results { changed, results } => {
            assert!(changed);
            assert_eq!(ids(&results), "c,d");
        }
        ResultWindowBufferChangeResult::RunFullQueryAgain => panic!("must not run the full query"),
    }

    // a changed row at the same position is reported as changed
    let mut buffer = buffer_of(q(true, None, Some(2)), 0, 0);
    buffer.reset(vec![doc("a", 1), doc("b", 3)]);
    let result = buffer.apply_change_events(&[ChangeEvent::Update {
        id: "a".to_string(),
        doc: doc("a", 2),
        previous: doc("a", 1),
    }]);
    assert!(matches!(
        result,
        ResultWindowBufferChangeResult::Results { changed: true, .. }
    ));
}

#[test]
fn apply_change_events_asks_for_a_full_query_when_the_result_window_does_not_fit_into_the_buffer() {
    let mut buffer = buffer_of(q(true, None, Some(2)), 0, 0);
    assert_eq!(
        buffer.apply_change_events(&[]),
        ResultWindowBufferChangeResult::RunFullQueryAgain
    );
    buffer.reset(vec![doc("a", 1), doc("b", 2)]);
    let result = buffer.apply_change_events(&[ChangeEvent::Delete {
        id: "a".to_string(),
        previous: doc("a", 1),
    }]);
    assert_eq!(result, ResultWindowBufferChangeResult::RunFullQueryAgain);
}

#[test]
fn apply_change_events_returns_the_same_as_a_full_query_for_random_batches() {
    let mut random = Random::new(4242);
    let mut new_id = counter_ids();
    for query in QUERIES {
        let mut docs = BTreeMap::new();
        for _ in 0..30 {
            let event = random_change_event(&docs, &mut random, &mut new_id, ONLY_INSERTS);
            apply_to_docs(&mut docs, &event);
        }
        let params = query_params(query);
        let skip = query.skip.unwrap_or(0);
        let mut buffer = buffer_of(query, 3, 3);
        fill(&mut buffer, &docs);
        let mut previous_results = run_query(&docs, &params, skip, query.limit);
        for batch in 0..100 {
            let batch_size = 1 + (random.next() * 5.0) as usize;
            let mut events = Vec::new();
            for i in 0..batch_size {
                let event =
                    random_change_event(&docs, &mut random, &mut new_id, weights(batch * 5 + i));
                apply_to_docs(&mut docs, &event);
                events.push(event);
            }
            let expected = run_query(&docs, &params, skip, query.limit);
            match buffer.apply_change_events(&events) {
                ResultWindowBufferChangeResult::RunFullQueryAgain => fill(&mut buffer, &docs),
                ResultWindowBufferChangeResult::Results { changed, results } => {
                    assert_eq!(ids(&results), ids(&expected));
                    assert_eq!(changed, expected != previous_results);
                }
            }
            previous_results = expected;
        }
    }
}

#[test]
fn a_buffer_with_both_sizes_0_never_runs_the_full_query_when_event_reduce_alone_does_not() {
    let mut event_reduce_full_queries = 0;
    let mut buffer_full_queries = 0;
    let mut seed = 1000;
    for query in QUERIES {
        for initial_rows in INITIAL_ROWS {
            seed += 1;
            let mut random = Random::new(seed);
            let mut new_id = counter_ids();
            let mut docs = BTreeMap::new();
            for _ in 0..initial_rows {
                let event = random_change_event(&docs, &mut random, &mut new_id, ONLY_INSERTS);
                apply_to_docs(&mut docs, &event);
            }
            let params = query_params(query);
            let skip = query.skip.unwrap_or(0);
            let mut previous_results = run_query(&docs, &params, skip, query.limit);
            let to_map = |docs: &[Doc]| -> HashMap<String, Doc> {
                docs.iter().map(|d| (d.id.clone(), d.clone())).collect()
            };
            let mut key_document_map = to_map(&previous_results);
            let mut buffer = buffer_of(query, 0, 0);
            fill(&mut buffer, &docs);

            for i in 0..EVENTS_PER_RUN {
                let event = random_change_event(&docs, &mut random, &mut new_id, weights(i));
                apply_to_docs(&mut docs, &event);

                let action = calculate_action_name(&StateResolveFunctionInput {
                    query_params: &params,
                    change_event: &event,
                    previous_results: &previous_results,
                    key_document_map: Some(&key_document_map),
                });
                let event_reduce_needs_query = action == ActionName::RunFullQueryAgain;
                if event_reduce_needs_query {
                    event_reduce_full_queries += 1;
                    previous_results = run_query(&docs, &params, skip, query.limit);
                    key_document_map = to_map(&previous_results);
                } else {
                    run_action(
                        action,
                        &params,
                        &event,
                        &mut previous_results,
                        Some(&mut key_document_map),
                    )
                    .unwrap();
                }

                let buffer_needs_query = buffer.apply_change_event(&event)
                    == ResultWindowBufferResult::RunFullQueryAgain;
                if buffer_needs_query {
                    buffer_full_queries += 1;
                    fill(&mut buffer, &docs);
                }
                assert!(
                    !buffer_needs_query || event_reduce_needs_query,
                    "buffer needs a full query but EventReduce does not at event #{}",
                    i
                );
                assert_eq!(
                    results(&buffer),
                    ids(&run_query(&docs, &params, skip, query.limit))
                );
            }
        }
    }
    assert!(buffer_full_queries <= event_reduce_full_queries);
}

#[test]
fn randomized_against_a_full_query() {
    let mut counts: HashMap<ResultWindowBufferResult, usize> = HashMap::new();
    let mut seed = 0;
    for query in QUERIES {
        for (limit_buffer_size, skip_buffer_size) in BUFFER_SIZES {
            for initial_rows in INITIAL_ROWS {
                seed += 1;
                let mut random = Random::new(seed);
                let mut counter = 0;
                let mut new_id = |random: &mut Random| {
                    counter += 1;
                    format!("{:09}-{}", (random.next() * 1e9) as u64, counter)
                };
                let mut docs = BTreeMap::new();
                for _ in 0..initial_rows {
                    let event = random_change_event(&docs, &mut random, &mut new_id, ONLY_INSERTS);
                    apply_to_docs(&mut docs, &event);
                }
                let params = query_params(query);
                let skip = query.skip.unwrap_or(0);
                let mut buffer = buffer_of(query, limit_buffer_size, skip_buffer_size);
                fill(&mut buffer, &docs);

                for i in 0..EVENTS_PER_RUN {
                    let event = random_change_event(&docs, &mut random, &mut new_id, weights(i));
                    apply_to_docs(&mut docs, &event);

                    let result = buffer.apply_change_event(&event);
                    *counts.entry(result).or_insert(0) += 1;
                    if result == ResultWindowBufferResult::RunFullQueryAgain {
                        fill(&mut buffer, &docs);
                    }
                    let context = format!(
                        "seed {} event #{} ({:?}, {:?})",
                        seed,
                        i,
                        event.operation(),
                        result
                    );

                    // the visible result equals the full query
                    assert_eq!(
                        results(&buffer),
                        ids(&run_query(&docs, &params, skip, query.limit)),
                        "visible result differs from full query at {}",
                        context
                    );

                    // the buffer is an exact slice of the full result
                    let full = run_query(&docs, &params, 0, None);
                    if !buffer.buffer().is_empty() {
                        let start = buffer.offset().min(full.len());
                        let end = (buffer.offset() + buffer.buffer().len()).min(full.len());
                        assert_eq!(
                            ids(buffer.buffer()),
                            ids(&full[start..end]),
                            "buffer is not an exact slice of the full result at {}",
                            context
                        );
                    } else {
                        // an empty buffer only knows an upper bound of the rows before it
                        assert!(
                            buffer.is_complete(),
                            "empty buffer must be complete at {}",
                            context
                        );
                        assert!(
                            full.len() <= buffer.offset(),
                            "offset is no upper bound at {}",
                            context
                        );
                    }
                    if buffer.is_complete() {
                        assert!(
                            buffer.offset() + buffer.buffer().len() >= full.len(),
                            "complete buffer misses rows at {}",
                            context
                        );
                    }

                    // the buffer keeps no more rows than requested on both sides
                    let rows_before = skip as i64 - buffer.offset() as i64;
                    assert!(
                        rows_before <= skip_buffer_size.min(1 << 40) as i64,
                        "too many rows before the window"
                    );
                    if let Some(limit) = query.limit {
                        if limit_buffer_size != ALL {
                            assert!(
                                buffer.buffer().len()
                                    <= rows_before.max(0) as usize + limit + limit_buffer_size,
                                "too many rows after the window"
                            );
                        }
                    }

                    // the key map matches the buffer
                    assert_eq!(buffer.key_document_map().len(), buffer.buffer().len());
                    for d in buffer.buffer() {
                        assert_eq!(buffer.key_document_map().get(&d.id), Some(d));
                    }
                }
            }
        }
    }
    // all three paths are used
    for result in [
        ResultWindowBufferResult::EventReduce,
        ResultWindowBufferResult::Buffer,
        ResultWindowBufferResult::RunFullQueryAgain,
    ] {
        assert!(
            counts.get(&result).copied().unwrap_or(0) > 0,
            "{:?}",
            counts
        );
    }
}
