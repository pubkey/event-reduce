# EventReduce (Swift)

Swift implementation of the [EventReduce algorithm](https://github.com/pubkey/event-reduce).
It takes the previous results of a query and a change event of the database
and calculates the new results **in memory, without running the query over the database again**.

It uses the same binary decision diagram as the [JavaScript implementation](../javascript/),
so both always decide on the same action. Works on Apple platforms and Linux.

## Installation

Add the repository as a package dependency in Xcode, or in your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/pubkey/event-reduce.git", from: "7.0.0")
],
targets: [
    .target(name: "MyApp", dependencies: [.product(name: "EventReduce", package: "event-reduce")])
]
```

## Usage

```swift
import EventReduce

// Equatable is only needed for applyChangeEventsToResultWindowBuffer()
struct User: Equatable {
    let id: String
    let age: Int
}

// SELECT * FROM users WHERE age > 18 ORDER BY age, id LIMIT 10
let queryParams = QueryParams<User>(
    getDocumentId: { $0.id },
    limit: 10,
    queryMatcher: { $0.age > 18 },
    // like sorted(by:), two different documents must never be equal,
    // so sort by the primary key last
    areInIncreasingOrder: { ($0.age, $0.id) < ($1.age, $1.id) },
    // true if one of the sort fields differs between the two versions of a document
    sortFieldsChanged: { previous, doc in previous.age != doc.age }
)

var results = [User(id: "a", age: 20), User(id: "b", age: 30)]

// a change event from the change stream of your database
let changeEvent = ChangeEvent<User>.insert(id: "c", doc: User(id: "c", age: 25))

// throws EventReduceError.negativeLimit if the limit of the query is negative
let action = try calculateActionName(
    StateResolveFunctionInput(queryParams: queryParams, changeEvent: changeEvent, previousResults: results))
if action == .runFullQueryAgain {
    results = try await runQueryOnDatabase()  // EventReduce could not optimize this event
} else {
    try runAction(action, queryParams: queryParams, changeEvent: changeEvent, previousResults: &results)
    // -> [a, c, b]
}
```

### Key document map

For big result sets, pass a dictionary from the id to the document as `keyDocumentMap`
to both `calculateActionName()` and `runAction()`.
Its type is `ResultKeyDocumentMap<D>`, a `[DocumentId: D]`: create a key with `DocumentId(id)`.
`DocumentId` compares the bytes of the id, because for Swift's `String` the ids `"\u{E9}"` and `"e\u{301}"` are equal,
while they are two different documents for a database.
It is used to check whether a document is in the results without scanning them,
and `runAction()` keeps it in sync with the results.

### Differences to the JavaScript implementation

- `ChangeEvent` is an enum with the cases `insert`, `update` and `delete`.
- Instead of `primaryKey` and `sortFields`, the `QueryParams` take `getDocumentId`
  and `sortFieldsChanged`, so documents can be any Swift type.
- Instead of a comparator that returns a number, the `QueryParams` take `areInIncreasingOrder`
  like `sorted(by:)`.
- `runAction()` mutates the results `inout` and throws `EventReduceError.runFullQueryAgain`
  and `EventReduceError.unknownAction`.
  `alwaysWrong` is only used by the truth-table generator and throws like `unknownAction`.

## Result window buffer

For a query with a limit or a skip, EventReduce returns `runFullQueryAgain` when a row has to move into the result window that is not in the previous results:
the row after the window (when a row leaves a full window) or the last skipped row (when a row is added in front of the window).
The result window buffer avoids most of these full queries: it keeps `limitBufferSize` rows after the window and `skipBufferSize` skipped rows before it in memory.
It works like the [result window buffer of the JavaScript implementation](../docs/result-window-buffer.md),
which explains how it works, how to choose the buffer sizes and has measurements.

```swift
// recommended size: about log2(limit), at most 30
let size = getRecommendedResultWindowBufferSize(queryParams.limit)
let resultWindowBuffer = try createResultWindowBuffer(queryParams, limitBufferSize: size, skipBufferSize: size)
// run the query with the skip and limit of the buffer
resetResultWindowBuffer(resultWindowBuffer, try await runQuery(getResultWindowBufferQuery(resultWindowBuffer)))
// the rows of the original skip and limit
var results = try getResultWindowBufferResults(resultWindowBuffer)

// on new change events
switch applyChangeEventsToResultWindowBuffer(resultWindowBuffer, changeEvents) {
case .runFullQueryAgain:
    resetResultWindowBuffer(resultWindowBuffer, try await runQuery(getResultWindowBufferQuery(resultWindowBuffer)))
    results = try getResultWindowBufferResults(resultWindowBuffer)
case .results(let changed, let newResults):
    if changed { results = newResults }
}
```

`getResultWindowBufferQuery()` returns the `skip` and `limit` to run the query with, `limit` is nil if all rows after the skip are needed.
`resultWindowBufferAllRows` as a buffer size keeps all rows on that side.
`applyChangeEventsToResultWindowBuffer()` needs `Equatable` documents to find out if the results changed.

## Development

```sh
# from the root of the repository, where the Package.swift is
swift test
swift format lint -r -s --configuration swift/.swift-format Package.swift swift/Sources swift/Tests
```

The BDD is generated by the truth-table generator of the JavaScript implementation,
which also writes `Sources/EventReduce/BddGenerated.swift`. The tests run the [shared test suite](../test-suite/), the same tests as all other implementations.

## Who uses EventReduce

[RxDB](https://rxdb.info/), the local-first database, uses EventReduce for its live queries since [version 9.0.0](https://rxdb.info/releases/9.0.0.html), where it is enabled by default.
When an app subscribes to a query, RxDB keeps the results up to date by running each write event through EventReduce,
and only queries the storage again when EventReduce returns `runFullQueryAgain`.
