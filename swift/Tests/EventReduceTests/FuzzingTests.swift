import EventReduce
import XCTest

/// Seeded random numbers, so failures are reproducible.
private struct Xorshift {
    var state: UInt64

    mutating func next(_ max: Int) -> Int {
        state ^= state << 13
        state ^= state >> 7
        state ^= state << 17
        return Int(state % UInt64(max))
    }
}

/// Applies random change events and checks that the results of EventReduce
/// are equal to the results of running the full query over the database again.
final class FuzzingTests: XCTestCase {
    private func runFullQuery(_ params: QueryParams<Human>, _ db: [String: Human]) -> [Human] {
        let all = db.values.filter(params.queryMatcher).sorted(by: params.areInIncreasingOrder)
        let start = min(params.skip ?? 0, all.count)
        let end = params.limit.map { min(start + $0, all.count) } ?? all.count
        return Array(all[start..<end])
    }

    private func fuzz(_ seed: UInt64, _ skip: Int?, _ limit: Int?, _ useMap: Bool) throws -> Int {
        var random = Xorshift(state: seed)
        let params = queryParams(10, skip: skip, limit: limit)
        var db: [String: Human] = [:]
        var docIds: [String] = []
        var results = runFullQuery(params, db)
        var map: [String: Human]? = useMap ? toMap(results) : nil
        var optimized = 0
        for i in 0..<1000 {
            let event: ChangeEvent<Human>
            if docIds.isEmpty || random.next(3) == 0 {
                let doc = Human("doc\(i)", random.next(40))
                db[doc.id] = doc
                docIds.append(doc.id)
                event = insert(doc)
            } else {
                let index = random.next(docIds.count)
                let previous = db[docIds[index]]!
                if random.next(3) == 0 {
                    db[previous.id] = nil
                    docIds.remove(at: index)
                    event = delete(previous)
                } else {
                    var doc = previous
                    if random.next(4) == 0 {
                        doc.name = "renamed\(i)"
                    } else {
                        doc.age = random.next(40)
                    }
                    db[doc.id] = doc
                    event = update(previous, doc)
                }
            }

            let action = calculateActionName(
                StateResolveFunctionInput(
                    queryParams: params, changeEvent: event, previousResults: results, keyDocumentMap: map))
            XCTAssertNotEqual(action, .unknownAction)
            if action == .runFullQueryAgain {
                results = runFullQuery(params, db)
                map = useMap ? toMap(results) : nil
            } else {
                optimized += 1
                try runAction(
                    action, queryParams: params, changeEvent: event, previousResults: &results,
                    keyDocumentMap: &map)
                XCTAssertEqual(
                    results, runFullQuery(params, db), "wrong results after \(action) on \(event) (seed \(seed))")
                if useMap {
                    XCTAssertEqual(map, toMap(results))
                }
            }
        }
        return optimized
    }

    func testSameResultsAsRunningTheFullQuery() throws {
        let cases: [(Int?, Int?, Bool)] = [
            (nil, nil, false),
            (nil, nil, true),
            (nil, 1, false),
            (nil, 5, false),
            (nil, 5, true),
            (3, 5, false),
            (3, 5, true),
        ]
        for (skip, limit, useMap) in cases {
            for seed in UInt64(1)...10 {
                XCTAssertGreaterThan(try fuzz(seed * 7919, skip, limit, useMap), 0)
            }
        }
    }
}
