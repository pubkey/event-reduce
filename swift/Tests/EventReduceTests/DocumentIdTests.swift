import EventReduce
import XCTest

private struct Row: Equatable {
    let id: String
    let age: Int
}

/// Swift's String is equal for canonically equivalent strings,
/// but ids that differ in their bytes are different documents.
final class DocumentIdTests: XCTestCase {
    /// "é" as one scalar and as "e" with a combining accent.
    private let precomposed = "\u{E9}"
    private let decomposed = "e\u{301}"

    private let queryParams = QueryParams<Row>(
        getDocumentId: { $0.id },
        queryMatcher: { _ in true },
        // ids are compared by their bytes, like in the database
        areInIncreasingOrder: { a, b in
            a.age != b.age ? a.age < b.age : a.id.utf8.lexicographicallyPrecedes(b.id.utf8)
        },
        sortFieldsChanged: { $0.age != $1.age }
    )

    func testDocumentIdComparesBytes() {
        XCTAssertEqual(precomposed, decomposed, "the two strings are equal for Swift")
        XCTAssertNotEqual(DocumentId(precomposed), DocumentId(decomposed))
        XCTAssertEqual(DocumentId(precomposed), DocumentId("\u{E9}"))
        XCTAssertFalse(isSameDocumentId(precomposed, decomposed))
        XCTAssertTrue(isSameDocumentId("a", "a"))

        let map: ResultKeyDocumentMap<Int> = [DocumentId(precomposed): 1, DocumentId(decomposed): 2, "a": 3]
        XCTAssertEqual(map.count, 3)
        XCTAssertEqual(map[DocumentId(decomposed)], 2)
    }

    func testInsertOfADocumentWithAnEquivalentId() throws {
        // without a key document map, and with one
        for useMap in [false, true] {
            let first = Row(id: precomposed, age: 3)
            let last = Row(id: "z", age: 6)
            let inserted = Row(id: decomposed, age: 4)
            var results = [first, last]
            var map: ResultKeyDocumentMap<Row>? =
                useMap ? [DocumentId(first.id): first, DocumentId(last.id): last] : nil
            let event = ChangeEvent<Row>.insert(id: inserted.id, doc: inserted)

            let action = try calculateActionName(
                StateResolveFunctionInput(
                    queryParams: queryParams, changeEvent: event, previousResults: results, keyDocumentMap: map))
            XCTAssertEqual(action, .insertAtSortPosition)
            try runAction(
                action, queryParams: queryParams, changeEvent: event, previousResults: &results, keyDocumentMap: &map)
            XCTAssertEqual(results, [first, inserted, last])
            if useMap {
                XCTAssertEqual(map?.count, 3)
            }
        }
    }

    func testDeleteOfADocumentWithAnEquivalentIdOutsideOfTheResults() throws {
        var params = queryParams
        params.limit = 1
        let inResults = Row(id: precomposed, age: 1)
        let other = Row(id: decomposed, age: 5)
        let action = try calculateActionName(
            StateResolveFunctionInput(
                queryParams: params, changeEvent: .delete(id: other.id, previous: other),
                previousResults: [inResults]))
        XCTAssertEqual(action, .doNothing)
    }
}
