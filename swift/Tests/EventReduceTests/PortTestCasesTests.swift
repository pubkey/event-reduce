import EventReduce
import Foundation
import XCTest

// Runs the test cases that the JavaScript implementation created,
// see javascript/test/helper/port-test-cases.ts.
// This implementation only resolves the BDD that was created there,
// so it must calculate the same state set and action for every case.

private struct Doc: Codable, Equatable {
    let id: String
    let age: Int
}

private struct PortTestCase: Decodable {
    struct Query: Decodable {
        let minAge: Int
        let skip: Int?
        let limit: Int?
    }

    struct Event: Decodable {
        let operation: String
        let id: String
        let doc: Doc?
        let previous: Doc?
    }

    let query: Query
    let previousResults: [Doc]
    let changeEvent: Event
    let stateSet: String
    let action: String
}

/// The query of the test cases: age > minAge, sorted by age, then by id.
private func queryParams(_ query: PortTestCase.Query) -> QueryParams<Doc> {
    QueryParams(
        getDocumentId: { $0.id },
        skip: query.skip,
        limit: query.limit,
        queryMatcher: { $0.age > query.minAge },
        areInIncreasingOrder: { ($0.age, $0.id) < ($1.age, $1.id) },
        sortFieldsChanged: { $0.age != $1.age }
    )
}

private func changeEvent(_ event: PortTestCase.Event) -> ChangeEvent<Doc> {
    switch event.operation {
    case "INSERT": return .insert(id: event.id, doc: event.doc!)
    case "UPDATE": return .update(id: event.id, doc: event.doc!, previous: event.previous!)
    default: return .delete(id: event.id, previous: event.previous!)
    }
}

final class PortTestCasesTests: XCTestCase {
    func testSameStateSetAndActionAsTheJavaScriptImplementation() throws {
        let file = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("javascript/test/fixtures/port-test-cases.json")
        let cases = try JSONDecoder().decode([PortTestCase].self, from: Data(contentsOf: file))
        XCTAssertGreaterThan(cases.count, 100)
        for (index, testCase) in cases.enumerated() {
            let input = StateResolveFunctionInput(
                queryParams: queryParams(testCase.query),
                changeEvent: changeEvent(testCase.changeEvent),
                previousResults: testCase.previousResults)
            XCTAssertEqual(getStateSet(input), testCase.stateSet, "state set of case #\(index)")
            XCTAssertEqual(calculateActionName(input).rawValue, testCase.action, "action of case #\(index)")
        }
    }
}
