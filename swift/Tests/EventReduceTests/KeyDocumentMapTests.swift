import EventReduce
import XCTest

private struct Row: Equatable {
    let id: String
    let age: Int
    var name = ""
}

/// When the key document map is out of sync and does not have a document that is in the results,
/// the actions must still find the document in the results, like the JavaScript implementation.
final class KeyDocumentMapTests: XCTestCase {
    private let queryParams = QueryParams<Row>(
        getDocumentId: { $0.id },
        queryMatcher: { _ in true },
        areInIncreasingOrder: { ($0.age, $0.id) < ($1.age, $1.id) },
        sortFieldsChanged: { $0.age != $1.age }
    )
    private let a = Row(id: "a", age: 1)
    private let b = Row(id: "b", age: 2)

    private func run(_ action: ActionName, _ event: ChangeEvent<Row>) throws -> ([Row], [String: Row]) {
        var results = [a, b]
        var keyDocumentMap: ResultKeyDocumentMap<Row>? = ["b": b]
        try runAction(
            action, queryParams: queryParams, changeEvent: event,
            previousResults: &results, keyDocumentMap: &keyDocumentMap)
        return (results, keyDocumentMap ?? [:])
    }

    func testRemoveExisting() throws {
        let (results, keyDocumentMap) = try run(.removeExisting, .delete(id: "a", previous: a))
        XCTAssertEqual(results, [b])
        XCTAssertEqual(keyDocumentMap, ["b": b])
    }

    func testReplaceExisting() throws {
        let changed = Row(id: "a", age: 1, name: "changed")
        let (results, keyDocumentMap) = try run(.replaceExisting, .update(id: "a", doc: changed, previous: a))
        XCTAssertEqual(results, [changed, b])
        XCTAssertEqual(keyDocumentMap, ["a": changed, "b": b])
    }

    func testRemoveExistingAndInsertAtSortPosition() throws {
        let moved = Row(id: "a", age: 5)
        let (results, keyDocumentMap) = try run(
            .removeExistingAndInsertAtSortPosition, .update(id: "a", doc: moved, previous: a))
        // no duplicate of the document
        XCTAssertEqual(results, [b, moved])
        XCTAssertEqual(keyDocumentMap, ["a": moved, "b": b])
    }
}
