import Foundation

// Result window buffer
// ------------
// For a query with a limit or a skip, EventReduce returns runFullQueryAgain
// when a row has to move into the result window that is not in the previous results:
// the row after the last row (a row left a full window) or the last skipped row
// (a row was added in front of the window).
// The result window buffer keeps rows on both sides of the window in memory,
// so these rows can be taken from memory instead.
// See docs/result-window-buffer.md for the explanation and measurements.
//
// Invariant: `buffer` is always an exact, contiguous slice of the full sorted result
// (without skip and limit): exactly `offset` matching rows sort before its first row,
// and it never contains a wrong row or misses a row in between.
// If `complete` is true, there are no rows after its last row.
// Only if the buffer is empty, `offset` can be larger than the real number of rows.

/// Pass it as a buffer size to keep all rows on that side of the result window.
public let resultWindowBufferAllRows = Int.max

/// Buffer sizes from this value on keep all rows.
/// Keeps the arithmetic far away from an overflow.
private let maxBufferSize = 1 << 40

public final class ResultWindowBuffer<D> {
    /// QueryParams of the original query, with the skip and limit that are shown to the user.
    public let queryParams: QueryParams<D>
    /// Amount of rows to keep after the last row of the result window.
    public let limitBufferSize: Int
    /// Amount of rows to keep before the first row of the result window, out of the skipped rows.
    public let skipBufferSize: Int
    public internal(set) var buffer: [D] = []
    public internal(set) var keyDocumentMap: [String: D] = [:]
    /// Number of matching rows that sort before the first row of the buffer.
    public internal(set) var offset = 0
    /// True if there are no rows after the last row of the buffer.
    public internal(set) var complete = false

    init(queryParams: QueryParams<D>, limitBufferSize: Int, skipBufferSize: Int) {
        self.queryParams = queryParams
        self.limitBufferSize = limitBufferSize
        self.skipBufferSize = skipBufferSize
    }
}

/// The skip and limit to run the query of the buffer with.
/// `limit` is nil if all rows after the skip are needed.
public struct ResultWindowBufferQuery: Equatable {
    public let skip: Int
    public let limit: Int?

    public init(skip: Int, limit: Int?) {
        self.skip = skip
        self.limit = limit
    }
}

/// What applyChangeEventToResultWindowBuffer() did.
public enum ResultWindowBufferResult: Hashable {
    /// An EventReduce action calculated the new buffer.
    case eventReduce
    /// EventReduce could not do it (or would have dropped a row), the slice rule did it.
    case buffer
    /// The caller must run the query with the skip and limit of
    /// getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer().
    case runFullQueryAgain
}

/// What applyChangeEventsToResultWindowBuffer() returns.
public enum ResultWindowBufferChangeResult<D> {
    /// Run the query of getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer().
    case runFullQueryAgain
    /// The rows of the original skip and limit,
    /// changed is true if they are not equal to the rows before the change events.
    case results(changed: Bool, results: [D])
}

/// Actions that keep the length of the result by dropping its first or last row.
/// The slice rule can keep that row instead.
private let actionsThatDropARow: Set<ActionName> = [
    .removeFirstItem,
    .removeLastItem,
    .removeFirstInsertLast,
    .removeLastInsertFirst,
    .removeFirstInsertFirst,
    .removeLastInsertLast,
    .insertAtSortPositionRemoveLast,
    .insertAtSortPositionRemoveFirst,
]

/// The recommended buffer size for each side of the result window.
/// About log2(limit) for small limits, grows faster around limit 400 and is at most 30.
/// Returns 0 for a limit of 1 (like a find-one query) and for queries without a limit.
public func getRecommendedResultWindowBufferSize(_ limit: Int?) -> Int {
    guard let limit = limit, limit != 0 else { return 0 }
    let ratio = 400.0 / Double(limit)
    let size = log2(Double(limit)) + 19.0 / (1.0 + ratio * ratio)
    return min(30, Int(size.rounded(.down)))
}

/// Creates an empty result window buffer.
/// Run the query with the skip and limit of getResultWindowBufferQuery()
/// and pass the rows to resetResultWindowBuffer() before using it.
/// `queryParams` has the skip and limit that are shown to the user.
/// `resultWindowBufferAllRows` keeps all rows on that side.
/// Throws on negative sizes.
public func createResultWindowBuffer<D>(
    _ queryParams: QueryParams<D>,
    limitBufferSize: Int = 0,
    skipBufferSize: Int = 0
) throws -> ResultWindowBuffer<D> {
    guard limitBufferSize >= 0, skipBufferSize >= 0 else {
        throw EventReduceError.invalidResultWindowBufferSize
    }
    // with limit 0 the result is always empty, so no rows are kept
    let isEmptyQuery = queryParams.limit == 0
    func size(_ size: Int) -> Int { isEmptyQuery ? 0 : min(size, maxBufferSize) }
    return ResultWindowBuffer(
        queryParams: queryParams, limitBufferSize: size(limitBufferSize), skipBufferSize: size(skipBufferSize))
}

private func getSkip<D>(_ resultWindowBuffer: ResultWindowBuffer<D>) -> Int {
    resultWindowBuffer.queryParams.skip ?? 0
}

/// The skip and limit to run the query of the buffer with.
public func getResultWindowBufferQuery<D>(_ resultWindowBuffer: ResultWindowBuffer<D>) -> ResultWindowBufferQuery {
    let skip = getSkip(resultWindowBuffer)
    let bufferSkip = max(0, skip - resultWindowBuffer.skipBufferSize)
    var bufferLimit: Int? = nil
    if let limit = resultWindowBuffer.queryParams.limit, resultWindowBuffer.limitBufferSize < maxBufferSize {
        bufferLimit = (skip - bufferSkip) + limit + resultWindowBuffer.limitBufferSize
    }
    return ResultWindowBufferQuery(skip: bufferSkip, limit: bufferLimit)
}

/// Set the buffer to the rows of a fresh query
/// that ran with the skip and limit of getResultWindowBufferQuery().
public func resetResultWindowBuffer<D>(_ resultWindowBuffer: ResultWindowBuffer<D>, _ rows: [D]) {
    let query = getResultWindowBufferQuery(resultWindowBuffer)
    let getId = resultWindowBuffer.queryParams.getDocumentId
    resultWindowBuffer.buffer = rows
    resultWindowBuffer.keyDocumentMap = Dictionary(rows.map { (getId($0), $0) }, uniquingKeysWith: { _, last in last })
    resultWindowBuffer.offset = query.skip
    // fewer rows than requested means there are no more rows
    if let limit = query.limit {
        resultWindowBuffer.complete = rows.count < limit
    } else {
        resultWindowBuffer.complete = true
    }
}

/// The result that is shown to the user.
/// Throws if the result window is not in the buffer, which happens
/// before resetResultWindowBuffer() was called
/// or when applyChangeEventToResultWindowBuffer() returned runFullQueryAgain
/// and the query did not run again.
public func getResultWindowBufferResults<D>(_ resultWindowBuffer: ResultWindowBuffer<D>) throws -> [D] {
    guard isResultWindowInBuffer(resultWindowBuffer) else {
        throw EventReduceError.resultWindowOutdated
    }
    let buffer = resultWindowBuffer.buffer
    let start = min(getSkip(resultWindowBuffer) - resultWindowBuffer.offset, buffer.count)
    var end = buffer.count
    if let limit = resultWindowBuffer.queryParams.limit {
        end = min(start + limit, buffer.count)
    }
    return Array(buffer[start..<end])
}

/// Updates the buffer with the change event.
@discardableResult
public func applyChangeEventToResultWindowBuffer<D>(
    _ resultWindowBuffer: ResultWindowBuffer<D>,
    _ changeEvent: ChangeEvent<D>
) -> ResultWindowBufferResult {
    let queryParams = resultWindowBuffer.queryParams
    if queryParams.limit == 0 {
        // the result of a query with limit 0 is always empty, nothing can change it
        return .eventReduce
    }
    if !resultWindowBuffer.complete && resultWindowBuffer.buffer.isEmpty {
        return .runFullQueryAgain
    }

    // 1. Let EventReduce handle the buffer as if it was the result of a query
    // with skip = offset and limit = buffer.count. This is exactly true,
    // because the buffer is an exact slice of the full result.
    // If the buffer is complete, we use buffer.count + 1, so EventReduce
    // knows that the limit is not reached and there are no more rows.
    var bufferQueryParams = queryParams
    bufferQueryParams.skip = resultWindowBuffer.offset > 0 ? resultWindowBuffer.offset : nil
    bufferQueryParams.limit = resultWindowBuffer.buffer.count + (resultWindowBuffer.complete ? 1 : 0)
    let action = calculateActionName(
        StateResolveFunctionInput(
            queryParams: bufferQueryParams, changeEvent: changeEvent,
            previousResults: resultWindowBuffer.buffer, keyDocumentMap: resultWindowBuffer.keyDocumentMap))
    var result: ResultWindowBufferResult
    if action == .runFullQueryAgain || action == .unknownAction || actionsThatDropARow.contains(action) {
        // 2. EventReduce needs a row before or after the buffer, which it does not know,
        // or it would drop a row to keep the length of the result.
        // But the buffer does not have to keep its length, only to stay an exact slice,
        // so the slice rule lets it shrink or grow instead.
        applySliceRule(resultWindowBuffer, changeEvent)
        result = .buffer
    } else {
        var map: [String: D]? = resultWindowBuffer.keyDocumentMap
        // release the buffer's own references so the action can mutate without copying
        resultWindowBuffer.keyDocumentMap = [:]
        var buffer = resultWindowBuffer.buffer
        resultWindowBuffer.buffer = []
        do {
            try runAction(
                action, queryParams: bufferQueryParams, changeEvent: changeEvent,
                previousResults: &buffer, keyDocumentMap: &map)
            resultWindowBuffer.buffer = buffer
            resultWindowBuffer.keyDocumentMap = map ?? [:]
            result = .eventReduce
        } catch {
            // only possible on a broken BDD, make sure the buffer is filled again
            resultWindowBuffer.complete = false
            return .runFullQueryAgain
        }
    }

    // 3. Do not let the buffer grow without bounds on either side.
    trimBuffer(resultWindowBuffer)

    // 4. Run the query again if the result window does not fit into the buffer anymore.
    if !isResultWindowInBuffer(resultWindowBuffer) {
        return .runFullQueryAgain
    }
    return result
}

/// Updates the buffer with all change events.
/// Returns the new results, and if they changed,
/// or runFullQueryAgain if the result window does not fit into the buffer anymore.
/// Then run the query of getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer().
public func applyChangeEventsToResultWindowBuffer<D: Equatable>(
    _ resultWindowBuffer: ResultWindowBuffer<D>,
    _ changeEvents: [ChangeEvent<D>]
) -> ResultWindowBufferChangeResult<D> {
    guard let previousResults = try? getResultWindowBufferResults(resultWindowBuffer) else {
        return .runFullQueryAgain
    }
    for changeEvent in changeEvents {
        if applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent) == .runFullQueryAgain {
            return .runFullQueryAgain
        }
    }
    guard let results = try? getResultWindowBufferResults(resultWindowBuffer) else {
        return .runFullQueryAgain
    }
    return .results(changed: results != previousResults, results: results)
}

/// True if all rows of the result window are in the buffer.
private func isResultWindowInBuffer<D>(_ resultWindowBuffer: ResultWindowBuffer<D>) -> Bool {
    let start = getSkip(resultWindowBuffer) - resultWindowBuffer.offset
    if start < 0 {
        return false
    }
    if resultWindowBuffer.complete {
        return true
    }
    guard let limit = resultWindowBuffer.queryParams.limit else { return false }
    return resultWindowBuffer.buffer.count >= start + limit
}

/// Removes rows before the window that are more than skipBufferSize
/// and rows after the window that are more than limitBufferSize.
private func trimBuffer<D>(_ resultWindowBuffer: ResultWindowBuffer<D>) {
    let getId = resultWindowBuffer.queryParams.getDocumentId

    let rowsBeforeWindow = getSkip(resultWindowBuffer) - resultWindowBuffer.offset
    let removeFromStart = min(rowsBeforeWindow - resultWindowBuffer.skipBufferSize, resultWindowBuffer.buffer.count)
    if removeFromStart > 0 {
        for doc in resultWindowBuffer.buffer[0..<removeFromStart] {
            resultWindowBuffer.keyDocumentMap.removeValue(forKey: getId(doc))
        }
        resultWindowBuffer.buffer.removeFirst(removeFromStart)
        resultWindowBuffer.offset += removeFromStart
    }

    if let limit = resultWindowBuffer.queryParams.limit {
        let maxLength =
            max(0, getSkip(resultWindowBuffer) - resultWindowBuffer.offset) + limit
            + resultWindowBuffer.limitBufferSize
        if resultWindowBuffer.buffer.count > maxLength {
            for doc in resultWindowBuffer.buffer[maxLength...] {
                resultWindowBuffer.keyDocumentMap.removeValue(forKey: getId(doc))
            }
            resultWindowBuffer.buffer.removeSubrange(maxLength...)
            resultWindowBuffer.complete = false
        }
    }
}

/// The slice rule:
/// Exactly `offset` matching rows sort before the first row of the buffer,
/// and all matching rows that sort between the first and the last row are in the buffer.
/// After the change event, this is still true for the old first and last row, so:
/// - the old version of the changed row is removed from the buffer,
/// - the new version is added if it sorts between the old first and last row,
/// - offset changes by one if the changed row moved into or out of the rows before the first row.
/// If offset is 0, there are no rows before the first row, so a row that sorts before it is added.
/// If the buffer is complete, there are no rows after the last row, so a row that sorts after it is added.
///
/// An empty buffer (only valid when complete) knows only the number of rows before it.
/// There, offset is only an upper bound, which stays an upper bound with the same update.
private func applySliceRule<D>(_ resultWindowBuffer: ResultWindowBuffer<D>, _ changeEvent: ChangeEvent<D>) {
    let queryParams = resultWindowBuffer.queryParams
    let previous = changeEvent.previous
    let doc = changeEvent.doc
    let wasMatching = previous.map(queryParams.queryMatcher) ?? false
    let doesMatchNow = doc.map(queryParams.queryMatcher) ?? false

    guard let first = resultWindowBuffer.buffer.first, let last = resultWindowBuffer.buffer.last else {
        if resultWindowBuffer.offset == 0 {
            // there are no rows at all
            if let doc = doc, doesMatchNow {
                insertAtSortPosition(resultWindowBuffer, doc)
            }
        } else {
            resultWindowBuffer.offset += (doesMatchNow ? 1 : 0) - (wasMatching ? 1 : 0)
        }
        return
    }

    let hasRowsBefore = resultWindowBuffer.offset > 0
    let isBefore = { (d: D) in hasRowsBefore && compareRows(queryParams, d, first) < 0 }
    let wasBefore = wasMatching && (previous.map(isBefore) ?? false)
    let isBeforeNow = doesMatchNow && (doc.map(isBefore) ?? false)

    let id = changeEvent.id
    if resultWindowBuffer.keyDocumentMap.removeValue(forKey: id) != nil {
        let getId = queryParams.getDocumentId
        if let index = resultWindowBuffer.buffer.firstIndex(where: { getId($0) == id }) {
            resultWindowBuffer.buffer.remove(at: index)
        }
    }
    if let doc = doc, doesMatchNow, !isBeforeNow,
        resultWindowBuffer.complete || compareRows(queryParams, doc, last) <= 0
    {
        insertAtSortPosition(resultWindowBuffer, doc)
    }
    resultWindowBuffer.offset += (isBeforeNow ? 1 : 0) - (wasBefore ? 1 : 0)
}

/// Compares two rows with the sort order of the query.
/// Returns 0 only for two versions of the same row that sort at the same position.
/// For different rows that the sort order sees as equal,
/// the primary key decides, so that the order is always deterministic.
private func compareRows<D>(_ queryParams: QueryParams<D>, _ a: D, _ b: D) -> Int {
    let result =
        queryParams.areInIncreasingOrder(a, b) ? -1 : (queryParams.areInIncreasingOrder(b, a) ? 1 : 0)
    if result != 0 {
        return result
    }
    let idA = queryParams.getDocumentId(a)
    let idB = queryParams.getDocumentId(b)
    if idA == idB {
        return 0
    }
    return idA < idB ? -1 : 1
}

private func insertAtSortPosition<D>(_ resultWindowBuffer: ResultWindowBuffer<D>, _ doc: D) {
    let queryParams = resultWindowBuffer.queryParams
    // binary search for the first row that sorts after doc
    var low = 0
    var high = resultWindowBuffer.buffer.count
    while low < high {
        let mid = (low + high) / 2
        if compareRows(queryParams, resultWindowBuffer.buffer[mid], doc) < 0 {
            low = mid + 1
        } else {
            high = mid
        }
    }
    resultWindowBuffer.buffer.insert(doc, at: low)
    resultWindowBuffer.keyDocumentMap[queryParams.getDocumentId(doc)] = doc
}
