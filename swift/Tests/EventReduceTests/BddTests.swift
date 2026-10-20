import EventReduce
import Foundation
import XCTest

final class BddTests: XCTestCase {
    func testPackedBddStringIsTheSameAsInTheJavaScriptImplementation() throws {
        let jsFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("javascript/src/bdd/bdd.generated.ts")
        let js = try String(contentsOf: jsFile, encoding: .utf8)
        XCTAssertTrue(
            js.contains("export const packedBddString = '\(packedBddString)';"),
            "swift BddGenerated.swift is out of sync with the JavaScript BDD")
    }

    func testPackedBddOnlyReferencesKnownStatesAndActions() {
        XCTAssertEqual(packedBdd.count % 3, 0)
        let n = packedBdd.count / 3
        for i in stride(from: 0, to: packedBdd.count, by: 3) {
            XCTAssertLessThan(packedBdd[i], orderedStateList.count)
            for ref in [packedBdd[i + 1], packedBdd[i + 2]] {
                XCTAssertTrue(ref < n || ref - n < orderedActionList.count)
            }
        }
    }

    func testInsertIntoEmptyResultsWithoutLimit() {
        let action = calculateActionName(
            StateResolveFunctionInput(
                queryParams: queryParams(10), changeEvent: insert(Human("a", 20)), previousResults: []))
        XCTAssertEqual(action, .insertFirst)
    }

    func testInsertOfNonMatchingDocumentDoesNothing() {
        let action = calculateActionName(
            StateResolveFunctionInput(
                queryParams: queryParams(10), changeEvent: insert(Human("a", 5)),
                previousResults: [Human("b", 20)]))
        XCTAssertEqual(action, .doNothing)
    }
}
