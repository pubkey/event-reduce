//! The result window buffer only compares ids for equality,
//! so it must work with an id type that has no ordering.

use event_reduce::*;

/// An id that can be compared and hashed, but not ordered.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
struct Id(String);

#[derive(Clone, Debug, PartialEq)]
struct Doc {
    id: Id,
    age: i64,
}

fn doc(id: &str, age: i64) -> Doc {
    Doc {
        id: Id(id.to_string()),
        age,
    }
}

#[test]
fn result_window_buffer_works_with_ids_that_have_no_ordering() {
    let query_params: QueryParams<Doc, Id> = QueryParams {
        get_document_id: |d| &d.id,
        skip: None,
        limit: Some(2),
        query_matcher: Box::new(|_| true),
        sort_comparator: Box::new(|a, b| a.age.cmp(&b.age).then_with(|| a.id.0.cmp(&b.id.0))),
        sort_fields_changed: Box::new(|previous, doc| previous.age != doc.age),
    };
    let mut buffer = ResultWindowBuffer::new(
        query_params,
        ResultWindowBufferSizes {
            limit_buffer_size: 2,
            skip_buffer_size: 0,
        },
    );
    buffer.reset(vec![doc("a", 1), doc("b", 2), doc("c", 3)]);
    let result = buffer.apply_change_event(&ChangeEvent::Insert {
        id: Id("x".to_string()),
        doc: doc("x", 2),
    });
    assert_eq!(result.as_str(), "eventReduce");
    let ids: Vec<&str> = buffer.buffer().iter().map(|d| d.id.0.as_str()).collect();
    assert_eq!(ids, ["a", "b", "x", "c"]);
}
