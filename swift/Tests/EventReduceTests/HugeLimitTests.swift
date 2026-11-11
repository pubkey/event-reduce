import EventReduce
import XCTest

private struct Row: Equatable {
    let id: String
}

/// A limit of Int.max, like when it is used for "no limit", must not overflow.
final class HugeLimitTests: XCTestCase {
    private func buffer(skip: Int?, limitBufferSize: Int, skipBufferSize: Int) throws -> ResultWindowBuffer<Row> {
        try createResultWindowBuffer(
            QueryParams<Row>(
                getDocumentId: { $0.id },
                skip: skip,
                limit: Int.max,
                queryMatcher: { _ in true },
                areInIncreasingOrder: { $0.id < $1.id },
                sortFieldsChanged: { _, _ in false }
            ),
            limitBufferSize: limitBufferSize,
            skipBufferSize: skipBufferSize)
    }

    func testHugeLimitWithLimitBuffer() throws {
        let buffer = try buffer(skip: nil, limitBufferSize: 1, skipBufferSize: 0)
        // more rows than an Int can count means that all rows are needed
        let query = getResultWindowBufferQuery(buffer)
        XCTAssertEqual(query.skip, 0)
        XCTAssertNil(query.limit)
        resetResultWindowBuffer(buffer, [Row(id: "a")])
        XCTAssertEqual(try getResultWindowBufferResults(buffer).map { $0.id }, ["a"])
    }

    func testHugeLimitWithSkipBuffer() throws {
        let buffer = try buffer(skip: 1, limitBufferSize: 0, skipBufferSize: 1)
        let query = getResultWindowBufferQuery(buffer)
        XCTAssertEqual(query.skip, 0)
        XCTAssertNil(query.limit)
        resetResultWindowBuffer(buffer, [Row(id: "a"), Row(id: "b")])
        let result = applyChangeEventToResultWindowBuffer(buffer, .insert(id: "c", doc: Row(id: "c")))
        XCTAssertEqual(result, .eventReduce)
        XCTAssertEqual(try getResultWindowBufferResults(buffer).map { $0.id }, ["b", "c"])
    }
}
