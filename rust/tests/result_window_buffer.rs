//! Basic tests of the result window buffer,
//! ported from javascript/test/unit/result-window-buffer.test.ts.

use event_reduce::*;

const ALL: usize = RESULT_WINDOW_BUFFER_ALL_ROWS;

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

fn ids(docs: &[Doc]) -> String {
    docs.iter()
        .map(|d| d.id.as_str())
        .collect::<Vec<_>>()
        .join(",")
}

fn results(buffer: &ResultWindowBuffer<Doc, String>) -> String {
    ids(buffer.results().unwrap())
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
fn returns_no_rows_for_a_query_with_limit_0() {
    let mut buffer = buffer_of(q(true, Some(2), Some(0)), 2, 2);
    // no rows are kept, so the buffer query asks for none
    assert_eq!(
        buffer.query(),
        ResultWindowBufferQuery {
            skip: 2,
            limit: Some(0)
        }
    );
    buffer.reset(Vec::new());
    let events = [
        ChangeEvent::Insert {
            id: "a".to_string(),
            doc: doc("a", 1),
        },
        ChangeEvent::Update {
            id: "a".to_string(),
            doc: doc("a", 2),
            previous: doc("a", 1),
        },
        ChangeEvent::Delete {
            id: "a".to_string(),
            previous: doc("a", 2),
        },
    ];
    for event in &events {
        assert_eq!(
            buffer.apply_change_event(event),
            ResultWindowBufferResult::EventReduce
        );
        assert_eq!(results(&buffer), "");
    }
}
