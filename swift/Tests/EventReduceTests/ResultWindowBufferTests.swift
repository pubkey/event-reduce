import EventReduce
import XCTest

// Port of javascript/test/unit/result-window-buffer.test.ts
// After every event, the visible result must equal the full query,
// and the buffer must be an exact slice of the full result.

private struct Doc: Equatable {
    let id: String
    var age: Int
    var female = true

    init(_ id: String, _ age: Int, female: Bool = true) {
        self.id = id
        self.age = age
        self.female = female
    }
}

private struct TestQuery: CustomStringConvertible {
    let asc: Bool
    var skip: Int? = nil
    var limit: Int? = nil

    var description: String {
        "sort \(asc ? "asc" : "desc"), skip \(String(describing: skip)), limit \(String(describing: limit))"
    }
}

private let queries = [
    TestQuery(asc: true, limit: 20),
    TestQuery(asc: false, limit: 20),
    TestQuery(asc: true, skip: 10, limit: 20),
    TestQuery(asc: false, skip: 10, limit: 20),
    TestQuery(asc: true, limit: 1),
    TestQuery(asc: false, skip: 3, limit: 5),
    // skip without limit
    TestQuery(asc: true, skip: 5),
    // neither skip nor limit
    TestQuery(asc: true),
]
private let all = resultWindowBufferAllRows
private let bufferSizes = [(0, 0), (5, 0), (0, 5), (20, 3), (50, 20), (all, all)]
private let initialRowsList = [0, 30, 300]
private let eventsPerRun = 600

private struct Weights {
    let insert: Double
    let update: Double
    let delete: Double
}
private let onlyInserts = Weights(insert: 1, update: 0, delete: 0)

/// First more inserts, then mostly updates, then more deletes,
/// so that the result grows, moves around and shrinks to (almost) nothing.
private func weights(_ eventIndex: Int) -> Weights {
    let phase = Double(eventIndex) / Double(eventsPerRun)
    if phase < 0.4 {
        return Weights(insert: 3, update: 5, delete: 1)
    } else if phase < 0.7 {
        return Weights(insert: 1, update: 8, delete: 1)
    }
    return Weights(insert: 1, update: 3, delete: 5)
}

/// The documents of the database.
/// Keeps the ids in an array, so picking a random document is deterministic and fast.
private struct Docs {
    private(set) var byId: [String: Doc] = [:]
    private var ids: [String] = []

    var isEmpty: Bool { ids.isEmpty }
    var count: Int { ids.count }
    var values: Dictionary<String, Doc>.Values { byId.values }

    func doc(at index: Int) -> Doc { byId[ids[index]]! }

    mutating func apply(_ changeEvent: ChangeEvent<Doc>) {
        let id = changeEvent.id
        if let doc = changeEvent.doc {
            if byId.updateValue(doc, forKey: id) == nil {
                ids.append(id)
            }
        } else if byId.removeValue(forKey: id) != nil {
            let index = ids.firstIndex(of: id)!
            ids.swapAt(index, ids.count - 1)
            ids.removeLast()
        }
    }
}

/// Seeded random numbers (splitmix64), so that every run produces the same events.
private struct SeededRandom: RandomNumberGenerator {
    var state: UInt64

    init(_ seed: UInt64) { state = seed }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

/// The query is always: female, sorted by age, then by id.
/// Age has only 100 different values, so many rows have the same age
/// and the id decides their order.
private func queryParams(_ query: TestQuery) -> QueryParams<Doc> {
    let asc = query.asc
    return QueryParams(
        getDocumentId: { $0.id },
        skip: query.skip,
        limit: query.limit,
        queryMatcher: { $0.female },
        areInIncreasingOrder: { a, b in
            asc ? (a.age, a.id) < (b.age, b.id) : (a.age, a.id) > (b.age, b.id)
        },
        sortFieldsChanged: { $0.age != $1.age }
    )
}

private func bufferOf(_ query: TestQuery, _ limitBufferSize: Int = 0, _ skipBufferSize: Int = 0)
    -> ResultWindowBuffer<Doc>
{
    try! createResultWindowBuffer(
        queryParams(query), limitBufferSize: limitBufferSize, skipBufferSize: skipBufferSize)
}

/// Full query over all documents: filter, sort, skip, limit.
private func runQuery(_ docs: Docs, _ params: QueryParams<Doc>, _ skip: Int, _ limit: Int?) -> [Doc] {
    let all = docs.values.filter(params.queryMatcher).sorted(by: params.areInIncreasingOrder)
    let start = min(skip, all.count)
    let end = limit.map { min(start + $0, all.count) } ?? all.count
    return Array(all[start..<end])
}

private func fill(_ buffer: ResultWindowBuffer<Doc>, _ docs: Docs) {
    let query = getResultWindowBufferQuery(buffer)
    resetResultWindowBuffer(buffer, runQuery(docs, buffer.queryParams, query.skip, query.limit))
}

private func ids(_ docs: [Doc]) -> String { docs.map { $0.id }.joined(separator: ",") }

private func results(_ buffer: ResultWindowBuffer<Doc>) -> String { ids(try! getResultWindowBufferResults(buffer)) }

private func insert(_ doc: Doc) -> ChangeEvent<Doc> { .insert(id: doc.id, doc: doc) }

private func update(_ previous: Doc, _ doc: Doc) -> ChangeEvent<Doc> {
    .update(id: doc.id, doc: doc, previous: previous)
}

private func delete(_ previous: Doc) -> ChangeEvent<Doc> { .delete(id: previous.id, previous: previous) }

private func randomChangeEvent(
    _ docs: Docs, _ random: inout SeededRandom, _ newId: () -> String, _ weights: Weights
) -> ChangeEvent<Doc> {
    let total = weights.insert + weights.update + weights.delete
    var r = Double.random(in: 0..<1, using: &random) * total
    if docs.isEmpty || r < weights.insert {
        let female = Double.random(in: 0..<1, using: &random) < 0.5
        return insert(Doc(newId(), Int.random(in: 1...100, using: &random), female: female))
    }
    r -= weights.insert
    let previous = docs.doc(at: Int.random(in: 0..<docs.count, using: &random))
    if r < weights.update {
        var doc = previous
        if Double.random(in: 0..<1, using: &random) < 0.5 {
            // starts or stops matching
            doc.female.toggle()
        } else {
            // moves in the sort order
            doc.age = Int.random(in: 1...100, using: &random)
        }
        return update(previous, doc)
    }
    return delete(previous)
}

private func applyToDocs(_ docs: inout Docs, _ changeEvent: ChangeEvent<Doc>) {
    docs.apply(changeEvent)
}

private func counterIds() -> () -> String {
    var counter = 0
    return {
        counter += 1
        return "id-" + String(format: "%05d", counter)
    }
}

final class ResultWindowBufferTests: XCTestCase {
    func testRecommendedSizeForEachLimit() {
        let expected: [(Int?, Int)] = [
            (nil, 0), (0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (10, 3), (20, 4),
            (100, 7), (200, 11), (500, 20), (1000, 26), (2711, 29), (2712, 30), (100000, 30),
        ]
        for (limit, size) in expected {
            XCTAssertEqual(getRecommendedResultWindowBufferSize(limit), size, "limit \(String(describing: limit))")
        }
    }

    func testQueryAddsTheBufferSizesToTheSkipAndLimit() {
        XCTAssertEqual(
            getResultWindowBufferQuery(bufferOf(TestQuery(asc: true, skip: 10, limit: 20), 5, 3)),
            ResultWindowBufferQuery(skip: 7, limit: 28))
        // not below skip 0
        XCTAssertEqual(
            getResultWindowBufferQuery(bufferOf(TestQuery(asc: true, skip: 2, limit: 20), 0, 5)),
            ResultWindowBufferQuery(skip: 0, limit: 22))
        // not set means 0
        XCTAssertEqual(
            getResultWindowBufferQuery(bufferOf(TestQuery(asc: true, skip: 10, limit: 20))),
            ResultWindowBufferQuery(skip: 10, limit: 20))
        // all rows
        XCTAssertEqual(
            getResultWindowBufferQuery(bufferOf(TestQuery(asc: true, skip: 10, limit: 20), all, all)),
            ResultWindowBufferQuery(skip: 0, limit: nil))
        // no limit for a query without a limit
        XCTAssertEqual(
            getResultWindowBufferQuery(bufferOf(TestQuery(asc: true, skip: 10), 5, 3)),
            ResultWindowBufferQuery(skip: 7, limit: nil))
    }

    func testThrowsOnNegativeBufferSizes() {
        let params = queryParams(TestQuery(asc: true, skip: 10, limit: 20))
        XCTAssertThrowsError(try createResultWindowBuffer(params, limitBufferSize: -1))
        XCTAssertThrowsError(try createResultWindowBuffer(params, skipBufferSize: -1))
    }

    func testReset() {
        // asks for a full query and has no results before it got rows
        var buffer = bufferOf(TestQuery(asc: true, limit: 2))
        XCTAssertThrowsError(try getResultWindowBufferResults(buffer)) { error in
            XCTAssertEqual(error as? EventReduceError, .resultWindowOutdated)
        }
        XCTAssertEqual(applyChangeEventToResultWindowBuffer(buffer, insert(Doc("a", 1))), .runFullQueryAgain)

        // complete when the query returned fewer rows than requested
        buffer = bufferOf(TestQuery(asc: true, limit: 2), 2)
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 2), Doc("c", 3)])
        XCTAssertTrue(buffer.complete)
        XCTAssertEqual(results(buffer), "a,b")

        // not complete when the query returned as many rows as requested
        buffer = bufferOf(TestQuery(asc: true, limit: 1), 1)
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 2)])
        XCTAssertFalse(buffer.complete)

        // shows the rows after the skipped rows of the buffer
        buffer = bufferOf(TestQuery(asc: true, skip: 1, limit: 2), 0, 1)
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 2), Doc("c", 3)])
        XCTAssertEqual(buffer.offset, 0)
        XCTAssertEqual(results(buffer), "b,c")
    }

    func testRefillsTheWindowFromTheBufferWhenAVisibleRowIsDeleted() {
        let buffer = bufferOf(TestQuery(asc: true, limit: 2), 2)
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 2), Doc("c", 3), Doc("d", 4)])
        XCTAssertEqual(applyChangeEventToResultWindowBuffer(buffer, delete(Doc("a", 1))), .buffer)
        XCTAssertEqual(results(buffer), "b,c")
        XCTAssertEqual(ids(buffer.buffer), "b,c,d")
    }

    func testDoesNotAppendARowThatMovesBehindTheLastRowOfTheBuffer() {
        let buffer = bufferOf(TestQuery(asc: true, limit: 2), 1)
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 2), Doc("c", 3)])
        XCTAssertEqual(applyChangeEventToResultWindowBuffer(buffer, update(Doc("a", 1), Doc("a", 99))), .buffer)
        XCTAssertEqual(ids(buffer.buffer), "b,c")
    }

    func testAsksForAFullQueryWhenARowIsAddedInFrontOfTheSkipWindowWithoutASkipBuffer() {
        let buffer = bufferOf(TestQuery(asc: true, skip: 1, limit: 1), 1)
        resetResultWindowBuffer(buffer, [Doc("b", 2), Doc("c", 3)])
        XCTAssertEqual(applyChangeEventToResultWindowBuffer(buffer, insert(Doc("x", 0))), .runFullQueryAgain)
        // the results are outdated until the query runs again
        XCTAssertThrowsError(try getResultWindowBufferResults(buffer))
    }

    func testTakesTheRowFromTheSkipBufferWhenARowIsAddedInFrontOfTheWindow() {
        let buffer = bufferOf(TestQuery(asc: true, skip: 2, limit: 1), 0, 1)
        // skip 1, limit 2: 'a' is skipped and not in the buffer
        resetResultWindowBuffer(buffer, [Doc("b", 2), Doc("c", 3)])
        XCTAssertEqual(results(buffer), "c")
        XCTAssertEqual(applyChangeEventToResultWindowBuffer(buffer, insert(Doc("x", 0))), .buffer)
        XCTAssertEqual(buffer.offset, 2)
        XCTAssertEqual(results(buffer), "b")
    }

    func testReturnsNoRowsForAQueryWithLimit0() {
        var random = SeededRandom(77)
        let newId = counterIds()
        for skip in [nil, 2] as [Int?] {
            var docs = Docs()
            for _ in 0..<10 {
                applyToDocs(&docs, randomChangeEvent(docs, &random, newId, onlyInserts))
            }
            let buffer = bufferOf(TestQuery(asc: true, skip: skip, limit: 0), 2, 2)
            fill(buffer, docs)
            // no rows are kept, so the buffer query asks for none
            XCTAssertEqual(getResultWindowBufferQuery(buffer), ResultWindowBufferQuery(skip: skip ?? 0, limit: 0))
            XCTAssertEqual(results(buffer), "")
            for i in 0..<100 {
                let event = randomChangeEvent(docs, &random, newId, weights(i))
                applyToDocs(&docs, event)
                XCTAssertEqual(applyChangeEventToResultWindowBuffer(buffer, event), .eventReduce)
                XCTAssertEqual(results(buffer), "")
                XCTAssertTrue(buffer.buffer.isEmpty)
            }
        }
    }

    func testHandlesAQueryWithASkipButWithoutALimit() {
        let buffer = bufferOf(TestQuery(asc: true, skip: 1), 0, 1)
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 2), Doc("c", 3)])
        XCTAssertEqual(results(buffer), "b,c")
        XCTAssertNotEqual(applyChangeEventToResultWindowBuffer(buffer, insert(Doc("x", 0))), .runFullQueryAgain)
        XCTAssertEqual(results(buffer), "a,b,c")
    }

    func testApplyChangeEventsReturnsTheNewResultsAndIfTheyChanged() {
        var buffer = bufferOf(TestQuery(asc: true, limit: 2), 3)
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 2), Doc("c", 3), Doc("d", 4), Doc("e", 5)])
        // a row after the result window changes
        guard
            case .results(let notVisibleChanged, _) = applyChangeEventsToResultWindowBuffer(
                buffer, [update(Doc("e", 5), Doc("e", 6))])
        else { return XCTFail("must not run the full query") }
        XCTAssertFalse(notVisibleChanged)

        guard
            case .results(let visibleChanged, let visibleResults) = applyChangeEventsToResultWindowBuffer(
                buffer, [delete(Doc("a", 1)), delete(Doc("b", 2))])
        else { return XCTFail("must not run the full query") }
        XCTAssertTrue(visibleChanged)
        XCTAssertEqual(ids(visibleResults), "c,d")

        // a changed row at the same position is reported as changed
        buffer = bufferOf(TestQuery(asc: true, limit: 2))
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 3)])
        guard
            case .results(let changed, _) = applyChangeEventsToResultWindowBuffer(
                buffer, [update(Doc("a", 1), Doc("a", 2))])
        else { return XCTFail("must not run the full query") }
        XCTAssertTrue(changed)
    }

    func testApplyChangeEventsAsksForAFullQueryWhenTheResultWindowDoesNotFitIntoTheBuffer() {
        let buffer = bufferOf(TestQuery(asc: true, limit: 2))
        guard case .runFullQueryAgain = applyChangeEventsToResultWindowBuffer(buffer, []) else {
            return XCTFail("must run the full query")
        }
        resetResultWindowBuffer(buffer, [Doc("a", 1), Doc("b", 2)])
        guard case .runFullQueryAgain = applyChangeEventsToResultWindowBuffer(buffer, [delete(Doc("a", 1))]) else {
            return XCTFail("must run the full query")
        }
    }

    func testApplyChangeEventsReturnsTheSameAsAFullQueryForRandomBatches() {
        var random = SeededRandom(4242)
        let newId = counterIds()
        for query in queries {
            var docs = Docs()
            for _ in 0..<30 {
                applyToDocs(&docs, randomChangeEvent(docs, &random, newId, onlyInserts))
            }
            let params = queryParams(query)
            let skip = query.skip ?? 0
            let buffer = bufferOf(query, 3, 3)
            fill(buffer, docs)
            var previousResults = runQuery(docs, params, skip, query.limit)
            for batch in 0..<100 {
                var events: [ChangeEvent<Doc>] = []
                for i in 0..<Int.random(in: 1...5, using: &random) {
                    let event = randomChangeEvent(docs, &random, newId, weights(batch * 5 + i))
                    applyToDocs(&docs, event)
                    events.append(event)
                }
                let expected = runQuery(docs, params, skip, query.limit)
                switch applyChangeEventsToResultWindowBuffer(buffer, events) {
                case .runFullQueryAgain:
                    fill(buffer, docs)
                case .results(let changed, let results):
                    XCTAssertEqual(ids(results), ids(expected))
                    XCTAssertEqual(changed, expected != previousResults)
                }
                previousResults = expected
            }
        }
    }

    func testABufferWithBothSizes0NeverRunsTheFullQueryWhenEventReduceAloneDoesNot() throws {
        var eventReduceFullQueries = 0
        var bufferFullQueries = 0
        var seed: UInt64 = 1000
        for query in queries {
            for initialRows in initialRowsList {
                seed += 1
                var random = SeededRandom(seed)
                let newId = counterIds()
                var docs = Docs()
                for _ in 0..<initialRows {
                    applyToDocs(&docs, randomChangeEvent(docs, &random, newId, onlyInserts))
                }
                let params = queryParams(query)
                let skip = query.skip ?? 0
                var previousResults = runQuery(docs, params, skip, query.limit)
                var keyDocumentMap: [String: Doc]? = Dictionary(
                    uniqueKeysWithValues: previousResults.map { ($0.id, $0) })
                let buffer = bufferOf(query)
                fill(buffer, docs)

                for i in 0..<eventsPerRun {
                    let event = randomChangeEvent(docs, &random, newId, weights(i))
                    applyToDocs(&docs, event)

                    let action = calculateActionName(
                        StateResolveFunctionInput(
                            queryParams: params, changeEvent: event, previousResults: previousResults,
                            keyDocumentMap: keyDocumentMap))
                    let eventReduceNeedsQuery = action == .runFullQueryAgain
                    if eventReduceNeedsQuery {
                        eventReduceFullQueries += 1
                        previousResults = runQuery(docs, params, skip, query.limit)
                        keyDocumentMap = Dictionary(uniqueKeysWithValues: previousResults.map { ($0.id, $0) })
                    } else {
                        try runAction(
                            action, queryParams: params, changeEvent: event, previousResults: &previousResults,
                            keyDocumentMap: &keyDocumentMap)
                    }

                    let bufferNeedsQuery = applyChangeEventToResultWindowBuffer(buffer, event) == .runFullQueryAgain
                    if bufferNeedsQuery {
                        bufferFullQueries += 1
                        fill(buffer, docs)
                    }
                    XCTAssertTrue(
                        !bufferNeedsQuery || eventReduceNeedsQuery,
                        "buffer needs a full query but EventReduce does not at event #\(i)")
                    XCTAssertEqual(results(buffer), ids(runQuery(docs, params, skip, query.limit)))
                }
            }
        }
        XCTAssertLessThanOrEqual(bufferFullQueries, eventReduceFullQueries)
    }

    func testRandomizedAgainstAFullQuery() {
        var counts: [ResultWindowBufferResult: Int] = [:]
        var seed: UInt64 = 0
        for query in queries {
            for (limitBufferSize, skipBufferSize) in bufferSizes {
                for initialRows in initialRowsList {
                    seed += 1
                    var random = SeededRandom(seed)
                    var idRandom = SeededRandom(seed &* 31)
                    var counter = 0
                    let newId = { () -> String in
                        counter += 1
                        return String(format: "%09d", Int.random(in: 0..<1_000_000_000, using: &idRandom))
                            + "-\(counter)"
                    }
                    var docs = Docs()
                    for _ in 0..<initialRows {
                        applyToDocs(&docs, randomChangeEvent(docs, &random, newId, onlyInserts))
                    }
                    let params = queryParams(query)
                    let skip = query.skip ?? 0
                    let buffer = bufferOf(query, limitBufferSize, skipBufferSize)
                    fill(buffer, docs)

                    for i in 0..<eventsPerRun {
                        let event = randomChangeEvent(docs, &random, newId, weights(i))
                        applyToDocs(&docs, event)

                        let result = applyChangeEventToResultWindowBuffer(buffer, event)
                        counts[result, default: 0] += 1
                        if result == .runFullQueryAgain {
                            fill(buffer, docs)
                        }
                        let context = {
                            "\(query), sizes \(limitBufferSize)/\(skipBufferSize), \(initialRows) rows, event #\(i) (\(event.operation), \(result))"
                        }

                        // the visible result equals the full query
                        XCTAssertEqual(
                            results(buffer), ids(runQuery(docs, params, skip, query.limit)),
                            "visible result differs from full query at \(context())")

                        // the buffer is an exact slice of the full result
                        let full = runQuery(docs, params, 0, nil)
                        if !buffer.buffer.isEmpty {
                            let start = min(buffer.offset, full.count)
                            let end = min(buffer.offset + buffer.buffer.count, full.count)
                            XCTAssertEqual(
                                ids(buffer.buffer), ids(Array(full[start..<end])),
                                "buffer is not an exact slice of the full result at \(context())")
                        } else {
                            // an empty buffer only knows an upper bound of the rows before it
                            XCTAssertTrue(buffer.complete, "empty buffer must be complete at \(context())")
                            XCTAssertLessThanOrEqual(
                                full.count, buffer.offset, "offset is no upper bound at \(context())")
                        }
                        if buffer.complete {
                            XCTAssertGreaterThanOrEqual(
                                buffer.offset + buffer.buffer.count, full.count,
                                "complete buffer misses rows at \(context())")
                        }

                        // the buffer keeps no more rows than requested on both sides
                        let rowsBefore = skip - buffer.offset
                        XCTAssertLessThanOrEqual(rowsBefore, skipBufferSize, "too many rows before the window")
                        if let limit = query.limit, limitBufferSize != all {
                            XCTAssertLessThanOrEqual(
                                buffer.buffer.count, max(0, rowsBefore) + limit + limitBufferSize,
                                "too many rows after the window")
                        }

                        // the key map matches the buffer
                        XCTAssertEqual(buffer.keyDocumentMap.count, buffer.buffer.count)
                        for d in buffer.buffer {
                            XCTAssertEqual(buffer.keyDocumentMap[d.id], d)
                        }
                    }
                }
            }
        }
        // all three paths are used
        for result in [ResultWindowBufferResult.eventReduce, .buffer, .runFullQueryAgain] {
            XCTAssertGreaterThan(counts[result, default: 0], 0, "\(counts)")
        }
    }
}
