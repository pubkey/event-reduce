# Shared test suite

All implementations of EventReduce (JavaScript, Rust, Dart, Kotlin, Swift, C#, Python, Go) run this same test suite,
with the same inputs and the same expected outputs.
Each implementation has a small test runner that reads the JSON files and runs them with its own API.

The implementations in other languages than JavaScript do not create or optimize the BDD,
they only resolve the BDD that the JavaScript implementation created.
So the suite does not test the correctness of the BDD (the JavaScript implementation does that with fuzzing),
it tests that all implementations calculate the same things.
The JavaScript implementation is the reference: it runs the suite too, so every expected value matches it.

## Documents and queries

All documents are `{ "id": string, "age": number, "name"?: string }`.
All queries are `{ "minAge": number, "skip": number | null, "limit": number | null, "desc"?: boolean }` and mean:

- a document matches if `age > minAge`
- sorted by `age`, then by `id`, both descending if `desc` is true
- the sort fields changed if `age` changed

Change events are `{ "operation": "INSERT" | "UPDATE" | "DELETE", "id": string, "doc": doc | null, "previous": doc | null }`.
Errors are the codes of the JavaScript implementation without the `EventReduce:` prefix, like `RUN_FULL`.

## state-sets.json

Created by the JavaScript implementation with `npm run generate-test-suite` in `./javascript`,
a JavaScript test fails if it is outdated after the BDD changed.

- `packedBdd`: the entries of the packed BDD of the JavaScript implementation, the generated BDD entries of each implementation must be equal to them.
- `cases`: one realistic case for each state set that was found.
  For the `query`, the `previousResults` and the `changeEvent`, the state set must be `stateSet`
  and the calculated action must be `action`.

## cases.json

Written by hand.

- `actions`: run the `action` on a copy of the `previousResults`,
  with a key document map of the previous results if `useKeyDocumentMap` is true.
  If there is no `action`, calculate it first and it must be `expectedAction`.
  The results must be `expectedResults`, the key document map must have the documents of `expectedKeyDocumentMap`,
  and the action must fail with `expectedError` if it is set.
- `resultWindowBuffer`: create a result window buffer for the `query` with the buffer sizes
  (`"all"` keeps all rows on that side) and run the `steps` in order:
  - `query`: the skip and limit of the buffer query must be `expected`, `limit` is null for no limit
  - `reset`: reset the buffer with the `rows`
  - `results`: the ids of the results must be `expected`, or reading them must fail with `expectedError`
  - `applyChangeEvent`: apply the `changeEvent`, the result must be `expected`
  - `applyChangeEvents`: apply the `changeEvents`, the result must be `expected`, with the ids of the results
  - `inspect`: the ids of the rows in the buffer, the offset and if it is complete must be `expected`
- `recommendedResultWindowBufferSize`: pairs of a limit (null for none) and the recommended buffer size.
