import EventReduce
import XCTest

// Basic tests of the result window buffer,
// ported from javascript/test/unit/result-window-buffer.test.ts.

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

private let all = resultWindowBufferAllRows

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

private func ids(_ docs: [Doc]) -> String { docs.map { $0.id }.joined(separator: ",") }

private func results(_ buffer: ResultWindowBuffer<Doc>) -> String { ids(try! getResultWindowBufferResults(buffer)) }

private func insert(_ doc: Doc) -> ChangeEvent<Doc> { .insert(id: doc.id, doc: doc) }

private func update(_ previous: Doc, _ doc: Doc) -> ChangeEvent<Doc> {
    .update(id: doc.id, doc: doc, previous: previous)
}

private func delete(_ previous: Doc) -> ChangeEvent<Doc> { .delete(id: previous.id, previous: previous) }

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

    func testReturnsNoRowsForAQueryWithLimit0() {
        let buffer = bufferOf(TestQuery(asc: true, skip: 2, limit: 0), 2, 2)
        // no rows are kept, so the buffer query asks for none
        XCTAssertEqual(getResultWindowBufferQuery(buffer), ResultWindowBufferQuery(skip: 2, limit: 0))
        resetResultWindowBuffer(buffer, [])
        for event in [insert(Doc("a", 1)), update(Doc("a", 1), Doc("a", 2)), delete(Doc("a", 2))] {
            XCTAssertEqual(applyChangeEventToResultWindowBuffer(buffer, event), .eventReduce)
            XCTAssertEqual(results(buffer), "")
        }
    }
}
