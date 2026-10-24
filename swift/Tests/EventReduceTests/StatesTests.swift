import EventReduce
import XCTest

final class StatesTests: XCTestCase {
    private func resolve(
        _ state: StateName,
        _ params: QueryParams<Human>,
        _ event: ChangeEvent<Human>,
        _ results: [Human],
        _ map: [String: Human]? = nil
    ) -> Bool {
        resolveState(
            state,
            StateResolveFunctionInput(
                queryParams: params, changeEvent: event, previousResults: results, keyDocumentMap: map))
    }

    func testStateNamesMatchTheJavaScriptOrder() {
        XCTAssertEqual(
            orderedStateList.map { $0.rawValue },
            [
                "isInsert", "isUpdate", "isDelete", "hasLimit", "isFindOne", "hasSkip",
                "wasResultsEmpty", "wasLimitReached", "wasFirst", "wasLast", "sortParamsChanged",
                "wasInResult", "wasSortedBeforeFirst", "wasSortedAfterLast", "isSortedBeforeFirst",
                "isSortedAfterLast", "wasMatching", "doesMatchNow",
            ])
    }

    func testLimitAndSkip() {
        let event = insert(Human("a", 20))
        var params = queryParams(0, skip: 2, limit: 1)
        XCTAssertTrue(resolve(.hasLimit, params, event, []))
        XCTAssertTrue(resolve(.isFindOne, params, event, []))
        XCTAssertTrue(resolve(.hasSkip, params, event, []))
        XCTAssertTrue(resolve(.wasLimitReached, params, event, [Human("b", 1)]))
        params = queryParams(0, skip: 0)
        XCTAssertFalse(resolve(.hasLimit, params, event, []))
        XCTAssertFalse(resolve(.isFindOne, params, event, []))
        XCTAssertFalse(resolve(.hasSkip, params, event, []))
        XCTAssertFalse(resolve(.wasLimitReached, params, event, [Human("b", 1)]))
    }

    func testOperations() {
        let params = queryParams(0)
        let event = delete(Human("a", 1))
        XCTAssertTrue(resolve(.isDelete, params, event, []))
        XCTAssertFalse(resolve(.isInsert, params, event, []))
        XCTAssertFalse(resolve(.isUpdate, params, event, []))
    }

    func testSortParamsChanged() {
        let params = queryParams(0)
        let a = Human("a", 1)
        XCTAssertFalse(resolve(.sortParamsChanged, params, update(a, Human("a", 1, name: "other")), []))
        XCTAssertTrue(resolve(.sortParamsChanged, params, update(a, Human("a", 2)), []))
        XCTAssertTrue(resolve(.sortParamsChanged, params, insert(a), []))
        XCTAssertFalse(resolve(.sortParamsChanged, params, delete(a), []))
    }

    func testWasInResultWithAndWithoutMap() {
        let params = queryParams(0)
        let event = update(Human("b", 1), Human("b", 2))
        let results = [Human("a", 1), Human("b", 1)]
        XCTAssertTrue(resolve(.wasInResult, params, event, results))
        XCTAssertFalse(resolve(.wasInResult, params, event, Array(results.prefix(1))))
        XCTAssertTrue(resolve(.wasInResult, params, event, results, toMap(results)))
    }

    func testFirstAndLast() {
        let params = queryParams(0)
        let results = [Human("a", 1), Human("b", 5), Human("c", 10)]
        var event = update(Human("a", 1), Human("a", 20))
        XCTAssertTrue(resolve(.wasFirst, params, event, results))
        XCTAssertFalse(resolve(.wasLast, params, event, results))
        // the changed document is the first one, so it must be true
        XCTAssertTrue(resolve(.wasSortedBeforeFirst, params, event, results))
        XCTAssertFalse(resolve(.wasSortedAfterLast, params, event, results))
        XCTAssertTrue(resolve(.isSortedAfterLast, params, event, results))
        event = insert(Human("d", 0))
        XCTAssertTrue(resolve(.isSortedBeforeFirst, params, event, results))
        XCTAssertFalse(resolve(.isSortedAfterLast, params, event, results))
        XCTAssertFalse(resolve(.wasSortedBeforeFirst, params, event, results))
        XCTAssertFalse(resolve(.isSortedBeforeFirst, params, event, []))
    }

    func testMatching() {
        let params = queryParams(10)
        let event = update(Human("a", 5), Human("a", 20))
        XCTAssertFalse(resolve(.wasMatching, params, event, []))
        XCTAssertTrue(resolve(.doesMatchNow, params, event, []))
        XCTAssertTrue(resolve(.wasResultsEmpty, params, event, []))
    }

    func testStateSet() {
        let set = getStateSet(
            StateResolveFunctionInput(
                queryParams: queryParams(0), changeEvent: insert(Human("a", 1)), previousResults: []))
        XCTAssertEqual(set, "100000100010000001")
    }

    func testIsSortedComparesWithTheNeighborWhenTheChangedDocumentIsFirstOrLast() {
        let params = queryParams(0)
        let results = [Human("a", 1), Human("b", 5), Human("c", 10)]
        // the first document moves behind the second one
        XCTAssertFalse(resolve(.isSortedBeforeFirst, params, update(Human("a", 1), Human("a", 7)), results))
        // the first document stays first
        XCTAssertTrue(resolve(.isSortedBeforeFirst, params, update(Human("a", 1), Human("a", 2)), results))
        // the last document moves before the second last one
        XCTAssertFalse(resolve(.isSortedAfterLast, params, update(Human("c", 10), Human("c", 3)), results))
        // the last document stays last
        XCTAssertTrue(resolve(.isSortedAfterLast, params, update(Human("c", 10), Human("c", 20)), results))
        // without a neighbor, the changed document is still first and last
        let event = update(Human("a", 1), Human("a", 7))
        XCTAssertTrue(resolve(.isSortedBeforeFirst, params, event, Array(results.prefix(1))))
        XCTAssertTrue(resolve(.isSortedAfterLast, params, event, Array(results.prefix(1))))
    }
}
