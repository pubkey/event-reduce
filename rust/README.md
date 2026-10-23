# event-reduce (Rust)

Rust implementation of the [EventReduce algorithm](https://github.com/pubkey/event-reduce).
It takes the previous results of a query and a change event of the database
and calculates the new results **in memory, without running the query over the database again**.

It uses the same binary decision diagram as the [JavaScript implementation](../javascript/),
so both always decide on the same action.

## Usage

```toml
[dependencies]
event-reduce = { git = "https://github.com/pubkey/event-reduce" }
```

```rust
use event_reduce::{
    calculate_action_name, run_action, ActionName, ChangeEvent, QueryParams,
    StateResolveFunctionInput,
};

#[derive(Clone, Debug, PartialEq)]
struct User {
    id: String,
    age: u32,
}

// SELECT * FROM users WHERE age > 18 ORDER BY age, id LIMIT 10
let query_params: QueryParams<User, String> = QueryParams {
    get_document_id: |doc| &doc.id,
    skip: None,
    limit: Some(10),
    query_matcher: Box::new(|doc| doc.age > 18),
    // must never return Equal for two different documents,
    // so sort by the primary key last
    sort_comparator: Box::new(|a, b| a.age.cmp(&b.age).then_with(|| a.id.cmp(&b.id))),
    // true if one of the sort fields differs between the two versions of a document
    sort_fields_changed: Box::new(|previous, doc| previous.age != doc.age),
};

let mut results = vec![
    User { id: "a".into(), age: 20 },
    User { id: "b".into(), age: 30 },
];

// a change event from the change stream of your database
let change_event = ChangeEvent::Insert {
    id: "c".to_string(),
    doc: User { id: "c".into(), age: 25 },
};

let action = calculate_action_name(&StateResolveFunctionInput {
    query_params: &query_params,
    change_event: &change_event,
    previous_results: &results,
    key_document_map: None,
});

if action == ActionName::RunFullQueryAgain {
    // EventReduce could not optimize this event,
    // results = run_query_on_database();
} else {
    run_action(action, &query_params, &change_event, &mut results, None).unwrap();
}

let ids: Vec<&str> = results.iter().map(|u| u.id.as_str()).collect();
assert_eq!(ids, vec!["a", "c", "b"]);
```

### Key document map

For big result sets, pass a `HashMap` from the id to the document as `key_document_map`
to both `calculate_action_name()` and `run_action()`.
It is used to check whether a document is in the results without scanning them,
and `run_action()` keeps it in sync with the results.

### Differences to the JavaScript implementation

- Change events are an enum with the variants `Insert`, `Update` and `Delete`.
- Instead of `primaryKey` and `sortFields`, the `QueryParams` take `get_document_id`
  and `sort_fields_changed` because Rust documents have no generic field access.
- `sort_comparator` returns a `std::cmp::Ordering`.
- `run_action()` returns `Err(EventReduceError::RunFullQueryAgain)` instead of throwing.
  `AlwaysWrong` is only used by the truth-table generator and returns `Err(EventReduceError::UnknownAction)`.

## Result window buffer

For a query with a limit or a skip, EventReduce returns `RunFullQueryAgain` when a row has to move into the result window that is not in the previous results:
the row after the window (when a row leaves a full window) or the last skipped row (when a row is added in front of the window).
The result window buffer avoids most of these full queries: it keeps `limit_buffer_size` rows after the window and `skip_buffer_size` skipped rows before it in memory.
It works like the [result window buffer of the JavaScript implementation](../docs/result-window-buffer.md),
which explains how it works, how to choose the buffer sizes and has measurements.

```rust
use event_reduce::{
    get_recommended_result_window_buffer_size, ChangeEvent, QueryParams, ResultWindowBuffer,
    ResultWindowBufferChangeResult, ResultWindowBufferQuery, ResultWindowBufferSizes,
};

#[derive(Clone, Debug, PartialEq)]
struct User {
    id: String,
    age: u32,
}

/// Runs the query with the given skip and limit on your database.
fn run_query(query: ResultWindowBufferQuery) -> Vec<User> {
    Vec::new()
}

let query_params: QueryParams<User, String> = QueryParams {
    get_document_id: |doc| &doc.id,
    skip: None,
    limit: Some(10),
    query_matcher: Box::new(|doc| doc.age > 18),
    sort_comparator: Box::new(|a, b| a.age.cmp(&b.age).then_with(|| a.id.cmp(&b.id))),
    sort_fields_changed: Box::new(|previous, doc| previous.age != doc.age),
};

// recommended size: about log2(limit), at most 30
let size = get_recommended_result_window_buffer_size(query_params.limit);
let mut buffer = ResultWindowBuffer::new(
    query_params,
    ResultWindowBufferSizes { limit_buffer_size: size, skip_buffer_size: size },
);
// run the query with the skip and limit of the buffer
buffer.reset(run_query(buffer.query()));
// the rows of the original skip and limit
let mut results = buffer.results().unwrap().to_vec();

// on new change events
let change_events: Vec<ChangeEvent<User, String>> = Vec::new();
match buffer.apply_change_events(&change_events) {
    ResultWindowBufferChangeResult::RunFullQueryAgain => {
        buffer.reset(run_query(buffer.query()));
        results = buffer.results().unwrap().to_vec();
    }
    ResultWindowBufferChangeResult::Results { changed: true, results: new_results } => results = new_results,
    ResultWindowBufferChangeResult::Results { changed: false, .. } => {}
}
```

`RESULT_WINDOW_BUFFER_ALL_ROWS` as a buffer size keeps all rows on that side.
`apply_change_events()` compares the rows by value to find out if the results changed.

## Development

```sh
cargo test
```

The BDD is generated by the truth-table generator of the JavaScript implementation,
which also writes `src/bdd_generated.rs`. A test ensures that both implementations use the same BDD.
