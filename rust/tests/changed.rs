//! The `changed` flag of apply_change_events() with rows that are not equal to themselves.

use event_reduce::*;

#[derive(Clone, Debug, PartialEq)]
struct Row {
    id: String,
    score: f64,
}

fn row(id: &str, score: f64) -> Row {
    Row {
        id: id.to_string(),
        score,
    }
}

fn buffer(rows: Vec<Row>) -> ResultWindowBuffer<Row, String> {
    let mut buffer = ResultWindowBuffer::new(
        QueryParams {
            get_document_id: |row: &Row| &row.id,
            skip: None,
            limit: Some(5),
            query_matcher: Box::new(|_| true),
            sort_comparator: Box::new(|a: &Row, b: &Row| a.id.cmp(&b.id)),
            sort_fields_changed: Box::new(|_, _| false),
        },
        ResultWindowBufferSizes {
            limit_buffer_size: 0,
            skip_buffer_size: 0,
        },
    );
    buffer.reset(rows);
    buffer
}

fn changed(result: ResultWindowBufferChangeResult<Row>) -> bool {
    match result {
        ResultWindowBufferChangeResult::Results { changed, .. } => changed,
        ResultWindowBufferChangeResult::RunFullQueryAgain => panic!("run full query again"),
    }
}

/// NaN is not equal to itself, so a row with a NaN value is never equal to itself.
/// Such a row must not make the results look changed when no change event was about it.
#[test]
fn row_that_is_not_equal_to_itself() {
    let b = row("b", 1.0);
    let mut buffer = buffer(vec![row("a", f64::NAN), b.clone()]);

    assert!(!changed(buffer.apply_change_events(&[])));
    // an event about a row that is not in the results
    assert!(!changed(buffer.apply_change_events(&[
        ChangeEvent::Delete {
            id: "z".to_string(),
            previous: row("z", 0.0),
        }
    ])));
    // an event that changes the other row
    assert!(changed(buffer.apply_change_events(&[
        ChangeEvent::Update {
            id: "b".to_string(),
            doc: row("b", 2.0),
            previous: b,
        }
    ])));
}

#[test]
fn rows_of_the_events_are_still_compared() {
    let a = row("a", 1.0);
    let mut buffer = buffer(vec![a.clone()]);
    // an update that changes nothing
    assert!(!changed(buffer.apply_change_events(&[
        ChangeEvent::Update {
            id: "a".to_string(),
            doc: a.clone(),
            previous: a,
        }
    ])));
    assert!(changed(buffer.apply_change_events(&[
        ChangeEvent::Insert {
            id: "b".to_string(),
            doc: row("b", 2.0),
        }
    ])));
}
