import EventReduce
import XCTest

private struct Row: Equatable {
    let id: String
    let age: Int
}

/// Like in SQL, a query with limit 0 returns no documents. A negative limit throws.
final class LimitTests: XCTestCase {
    private func queryParams(limit: Int?, skip: Int? = nil) -> QueryParams<Row> {
        QueryParams<Row>(
            getDocumentId: { $0.id },
            skip: skip,
            limit: limit,
            queryMatcher: { _ in true },
            areInIncreasingOrder: { ($0.age, $0.id) < ($1.age, $1.id) },
            sortFieldsChanged: { $0.age != $1.age }
        )
    }

    private let events: [ChangeEvent<Row>] = [
        .insert(id: "a", doc: Row(id: "a", age: 1)),
        .update(id: "a", doc: Row(id: "a", age: 2), previous: Row(id: "a", age: 1)),
        .delete(id: "a", previous: Row(id: "a", age: 1)),
    ]

    private func calculate(_ queryParams: QueryParams<Row>, _ event: ChangeEvent<Row>) throws -> ActionName {
        try calculateActionName(
            StateResolveFunctionInput(queryParams: queryParams, changeEvent: event, previousResults: []))
    }

    func testLimitZeroIsAlwaysDoNothing() throws {
        for skip in [nil, 0, 3] as [Int?] {
            for event in events {
                XCTAssertEqual(try calculate(queryParams(limit: 0, skip: skip), event), .doNothing)
            }
        }
    }

    func testOtherLimitsAreNotChanged() throws {
        XCTAssertEqual(try calculate(queryParams(limit: 1), events[0]), .insertFirst)
        XCTAssertEqual(try calculate(queryParams(limit: nil), events[0]), .insertFirst)
    }

    func testNegativeLimitThrows() throws {
        let input = StateResolveFunctionInput(
            queryParams: queryParams(limit: -1), changeEvent: events[0], previousResults: [])
        XCTAssertThrowsError(try calculateActionName(input)) { error in
            XCTAssertEqual(error as? EventReduceError, .negativeLimit)
        }
        XCTAssertThrowsError(try resolveInput(input)) { error in
            XCTAssertEqual(error as? EventReduceError, .negativeLimit)
        }
        XCTAssertThrowsError(try createResultWindowBuffer(queryParams(limit: -1))) { error in
            XCTAssertEqual(error as? EventReduceError, .negativeLimit)
            XCTAssertEqual((error as? EventReduceError)?.code, "NEG_LIMIT")
        }
        _ = try createResultWindowBuffer(queryParams(limit: 0))
    }
}
