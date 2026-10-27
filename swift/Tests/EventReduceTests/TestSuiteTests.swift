import EventReduce
import Foundation
import XCTest

// Runs the test suite that all implementations share, see ../test-suite/README.md.

/// Any JSON value, to compare the expected values of the test suite.
indirect enum JSON: Decodable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSON])
    case object([String: JSON])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSON].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSON].self))
        }
    }

    subscript(key: String) -> JSON? {
        if case .object(let object) = self { return object[key] }
        return nil
    }

    var string: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var int: Int? {
        if case .number(let value) = self { return Int(value) }
        return nil
    }

    var array: [JSON] {
        if case .array(let value) = self { return value }
        return []
    }
}

private struct Doc: Equatable {
    let id: String
    let age: Int
    let name: String

    init(_ json: JSON) {
        id = json["id"]!.string!
        age = json["age"]!.int!
        name = json["name"]?.string ?? ""
    }
}

private func load(_ file: String) throws -> JSON {
    let url = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .deletingLastPathComponent()
        .appendingPathComponent("test-suite/\(file)")
    return try JSONDecoder().decode(JSON.self, from: Data(contentsOf: url))
}

private func docs(_ json: JSON?) -> [Doc] { (json?.array ?? []).map(Doc.init) }

private func ids(_ docs: [Doc]) -> JSON { .array(docs.map { .string($0.id) }) }

private func number(_ value: Int?) -> JSON { value.map { .number(Double($0)) } ?? .null }

private func queryParams(_ query: JSON) -> QueryParams<Doc> {
    let minAge = query["minAge"]!.int!
    let desc = query["desc"] == .bool(true)
    return QueryParams(
        getDocumentId: { $0.id },
        skip: query["skip"]?.int,
        limit: query["limit"]?.int,
        queryMatcher: { $0.age > minAge },
        areInIncreasingOrder: { a, b in desc ? (a.age, a.id) > (b.age, b.id) : (a.age, a.id) < (b.age, b.id) },
        sortFieldsChanged: { $0.age != $1.age }
    )
}

private func changeEvent(_ json: JSON) -> ChangeEvent<Doc> {
    let id = json["id"]!.string!
    switch json["operation"]!.string! {
    case "INSERT": return .insert(id: id, doc: Doc(json["doc"]!))
    case "UPDATE": return .update(id: id, doc: Doc(json["doc"]!), previous: Doc(json["previous"]!))
    default: return .delete(id: id, previous: Doc(json["previous"]!))
    }
}

private func errorCode(_ error: Error) -> String {
    switch error as? EventReduceError {
    case .runFullQueryAgain: return "RUN_FULL"
    case .unknownAction: return "UNK_ACT"
    case .resultWindowOutdated: return "RWB_OUTDATED"
    case .invalidResultWindowBufferSize: return "RWB_SIZE"
    case nil: return "\(error)"
    }
}

private func bufferSize(_ json: JSON?) -> Int {
    json == .string("all") ? resultWindowBufferAllRows : json!.int!
}

private func resultName(_ result: ResultWindowBufferResult) -> String {
    switch result {
    case .eventReduce: return "eventReduce"
    case .buffer: return "buffer"
    case .runFullQueryAgain: return "runFullQueryAgain"
    }
}

final class TestSuiteTests: XCTestCase {
    func testStateSets() throws {
        let suite = try load("state-sets.json")
        XCTAssertEqual(
            suite["packedBddString"]?.string, packedBddString,
            "BddGenerated.swift is out of sync with the JavaScript BDD")
        for (index, testCase) in suite["cases"]!.array.enumerated() {
            let input = StateResolveFunctionInput(
                queryParams: queryParams(testCase["query"]!),
                changeEvent: changeEvent(testCase["changeEvent"]!),
                previousResults: docs(testCase["previousResults"]))
            XCTAssertEqual(getStateSet(input), testCase["stateSet"]?.string, "state set of case #\(index)")
            XCTAssertEqual(calculateActionName(input).rawValue, testCase["action"]?.string, "action of case #\(index)")
        }
    }

    func testActions() throws {
        for testCase in try load("cases.json")["actions"]!.array {
            let name = testCase["name"]!.string!
            let params = queryParams(testCase["query"]!)
            let event = changeEvent(testCase["changeEvent"]!)
            var results = docs(testCase["previousResults"])
            var keyDocumentMap: [String: Doc]? =
                testCase["useKeyDocumentMap"] == .bool(true)
                ? Dictionary(uniqueKeysWithValues: results.map { ($0.id, $0) }) : nil
            let action: ActionName
            if let actionName = testCase["action"]?.string {
                action = ActionName(rawValue: actionName)!
            } else {
                action = calculateActionName(
                    StateResolveFunctionInput(
                        queryParams: params, changeEvent: event, previousResults: results,
                        keyDocumentMap: keyDocumentMap))
                XCTAssertEqual(action.rawValue, testCase["expectedAction"]?.string, name)
            }
            var error: String?
            do {
                try runAction(
                    action, queryParams: params, changeEvent: event, previousResults: &results,
                    keyDocumentMap: &keyDocumentMap)
            } catch let err {
                error = errorCode(err)
            }
            XCTAssertEqual(error, testCase["expectedError"]?.string, name)
            XCTAssertEqual(results, docs(testCase["expectedResults"]), name)
            if let map = keyDocumentMap {
                XCTAssertEqual(
                    map.values.sorted { $0.id < $1.id }, docs(testCase["expectedKeyDocumentMap"]), name)
            }
        }
    }

    func testResultWindowBuffer() throws {
        for scenario in try load("cases.json")["resultWindowBuffer"]!.array {
            let name = scenario["name"]!.string!
            let buffer = try createResultWindowBuffer(
                queryParams(scenario["query"]!),
                limitBufferSize: bufferSize(scenario["limitBufferSize"]),
                skipBufferSize: bufferSize(scenario["skipBufferSize"]))
            for (index, step) in scenario["steps"]!.array.enumerated() {
                let op = step["op"]!.string!
                let context = "\(name): step #\(index) \(op)"
                switch op {
                case "query":
                    let query = getResultWindowBufferQuery(buffer)
                    XCTAssertEqual(
                        JSON.object(["skip": number(query.skip), "limit": number(query.limit)]), step["expected"],
                        context)
                case "reset":
                    resetResultWindowBuffer(buffer, docs(step["rows"]))
                case "results":
                    var results: JSON?
                    var error: String?
                    do {
                        results = ids(try getResultWindowBufferResults(buffer))
                    } catch let err {
                        error = errorCode(err)
                    }
                    XCTAssertEqual(results, step["expected"], context)
                    XCTAssertEqual(error, step["expectedError"]?.string, context)
                case "applyChangeEvent":
                    let result = applyChangeEventToResultWindowBuffer(buffer, changeEvent(step["changeEvent"]!))
                    XCTAssertEqual(resultName(result), step["expected"]?.string, context)
                case "applyChangeEvents":
                    let actual: JSON
                    switch applyChangeEventsToResultWindowBuffer(buffer, step["changeEvents"]!.array.map(changeEvent)) {
                    case .runFullQueryAgain:
                        actual = .object(["runFullQueryAgain": .bool(true)])
                    case .results(let changed, let results):
                        actual = .object([
                            "runFullQueryAgain": .bool(false), "changed": .bool(changed), "results": ids(results),
                        ])
                    }
                    XCTAssertEqual(actual, step["expected"], context)
                case "inspect":
                    let actual = JSON.object([
                        "buffer": ids(buffer.buffer), "offset": number(buffer.offset),
                        "complete": .bool(buffer.complete),
                    ])
                    XCTAssertEqual(actual, step["expected"], context)
                default:
                    XCTFail("\(context): unknown op")
                }
            }
        }
    }

    func testRecommendedResultWindowBufferSize() throws {
        for pair in try load("cases.json")["recommendedResultWindowBufferSize"]!.array {
            let limit = pair.array[0].int
            XCTAssertEqual(
                getRecommendedResultWindowBufferSize(limit), pair.array[1].int, "limit \(String(describing: limit))")
        }
    }
}
