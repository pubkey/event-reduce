import EventReduce
import XCTest

final class ActionsTests: XCTestCase {
    func testActionNamesMatchTheJavaScriptOrder() {
        XCTAssertEqual(
            orderedActionList.map { $0.rawValue },
            [
                "doNothing", "insertFirst", "insertLast", "removeFirstItem", "removeLastItem",
                "removeFirstInsertLast", "removeLastInsertFirst", "removeFirstInsertFirst",
                "removeLastInsertLast", "removeExisting", "replaceExisting", "alwaysWrong",
                "insertAtSortPosition", "removeExistingAndInsertAtSortPosition",
                "insertAtSortPositionRemoveLast", "insertAtSortPositionRemoveFirst", "runFullQueryAgain",
                "unknownAction",
            ])
    }

    func testAllActionsDoNotCrashOnAnyInput() {
        let params = queryParams(0, limit: 3)
        let events = [insert(Human("x", 3)), update(Human("b", 2), Human("b", 7)), delete(Human("b", 2))]
        let throwing: Set<ActionName> = [.alwaysWrong, .runFullQueryAgain, .unknownAction]
        for action in orderedActionList {
            for event in events {
                for start in [[], [Human("a", 1), Human("b", 2), Human("c", 3)]] {
                    for useMap in [true, false] {
                        var results = start
                        var map: [String: Human]? = useMap ? toMap(results) : nil
                        do {
                            try runAction(
                                action, queryParams: params, changeEvent: event,
                                previousResults: &results, keyDocumentMap: &map)
                            XCTAssertFalse(throwing.contains(action))
                        } catch {
                            // inserting actions on a delete event have no document
                            XCTAssertTrue(throwing.contains(action) || event.doc == nil)
                        }
                    }
                }
            }
        }
    }

    func testRunFullQueryAgainThrows() {
        var results = [Human("a", 1)]
        XCTAssertThrowsError(
            try runAction(
                .runFullQueryAgain, queryParams: queryParams(0), changeEvent: insert(Human("b", 1)),
                previousResults: &results)
        ) { error in
            XCTAssertEqual(error as? EventReduceError, .runFullQueryAgain)
        }
        XCTAssertEqual(ids(results), ["a"])
    }

    func testRemoveExistingFromTheMiddleKeepsTheMapInSync() throws {
        var results = [Human("a", 1), Human("b", 2), Human("c", 3)]
        var map: [String: Human]? = toMap(results)
        try runAction(
            .removeExisting, queryParams: queryParams(0), changeEvent: delete(Human("b", 2)),
            previousResults: &results, keyDocumentMap: &map)
        XCTAssertEqual(ids(results), ["a", "c"])
        XCTAssertEqual(Set(map!.keys), ["a", "c"])
    }

    func testReplaceExistingAtTheSamePosition() throws {
        var results = [Human("a", 1), Human("b", 2), Human("c", 3)]
        var map: [String: Human]? = toMap(results)
        let renamed = Human("b", 2, name: "new")
        try runAction(
            .replaceExisting, queryParams: queryParams(0), changeEvent: update(Human("b", 2), renamed),
            previousResults: &results, keyDocumentMap: &map)
        XCTAssertEqual(results[1], renamed)
        XCTAssertEqual(map!["b"], renamed)
    }

    func testInsertAtSortPosition() throws {
        let params = queryParams(0)
        var results: [Human] = []
        for doc in [Human("b", 5), Human("d", 9), Human("a", 5), Human("c", 7)] {
            try runAction(
                .insertAtSortPosition, queryParams: params, changeEvent: insert(doc), previousResults: &results)
        }
        XCTAssertEqual(ids(results), ["a", "b", "c", "d"])
        // inserting a document that is already in the results does nothing
        try runAction(
            .insertAtSortPosition, queryParams: params, changeEvent: insert(Human("c", 7)),
            previousResults: &results)
        XCTAssertEqual(ids(results), ["a", "b", "c", "d"])
    }

    func testRemoveFirstInsertLastWithMap() throws {
        var results = [Human("a", 1), Human("b", 2)]
        var map: [String: Human]? = toMap(results)
        try runAction(
            .removeFirstInsertLast, queryParams: queryParams(0, limit: 2), changeEvent: insert(Human("c", 3)),
            previousResults: &results, keyDocumentMap: &map)
        XCTAssertEqual(ids(results), ["b", "c"])
        XCTAssertEqual(Set(map!.keys), ["b", "c"])
    }

    func testInsertAtSortPositionRemoveLastAndFirst() throws {
        let params = queryParams(0, limit: 3)
        var results = [Human("a", 1), Human("c", 3), Human("e", 5)]
        var map: [String: Human]? = toMap(results)
        try runAction(
            .insertAtSortPositionRemoveLast, queryParams: params, changeEvent: insert(Human("b", 2)),
            previousResults: &results, keyDocumentMap: &map)
        XCTAssertEqual(ids(results), ["a", "b", "c"])
        try runAction(
            .insertAtSortPositionRemoveFirst, queryParams: params, changeEvent: insert(Human("d", 4)),
            previousResults: &results, keyDocumentMap: &map)
        XCTAssertEqual(ids(results), ["b", "c", "d"])
        XCTAssertEqual(Set(map!.keys), ["b", "c", "d"])
        // a document that is already in the results is not inserted, so nothing is removed
        try runAction(
            .insertAtSortPositionRemoveLast, queryParams: params, changeEvent: insert(Human("c", 3)),
            previousResults: &results)
        XCTAssertEqual(ids(results), ["b", "c", "d"])
    }
}
