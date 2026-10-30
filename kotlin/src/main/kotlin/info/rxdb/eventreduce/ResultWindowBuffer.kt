package info.rxdb.eventreduce

import kotlin.math.floor
import kotlin.math.log2
import kotlin.math.sign

/*
 * Result window buffer
 * ------------
 * For a query with a limit or a skip, EventReduce returns RunFullQueryAgain
 * when a row has to move into the result window that is not in the previous results:
 * the row after the last row (a row left a full window) or the last skipped row
 * (a row was added in front of the window).
 * The result window buffer keeps rows on both sides of the window in memory,
 * so these rows can be taken from memory instead.
 * See docs/result-window-buffer.md for the explanation and measurements.
 *
 * Invariant: `buffer` is always an exact, contiguous slice of the full sorted result
 * (without skip and limit): exactly `offset` matching rows sort before its first row,
 * and it never contains a wrong row or misses a row in between.
 * If `complete` is true, there are no rows after its last row.
 * Only if the buffer is empty, `offset` can be larger than the real number of rows.
 */

/** Pass it as a buffer size to keep all rows on that side of the result window. */
public const val RESULT_WINDOW_BUFFER_ALL_ROWS: Int = Int.MAX_VALUE

/**
 * Buffer sizes from this value on keep all rows.
 * Keeps the arithmetic far away from an overflow.
 */
private const val MAX_BUFFER_SIZE: Int = 1 shl 29

public class ResultWindowBuffer<D> internal constructor(
    /** QueryParams of the original query, with the skip and limit that are shown to the user. */
    public val queryParams: QueryParams<D>,
    /** Amount of rows to keep after the last row of the result window. */
    public val limitBufferSize: Int,
    /** Amount of rows to keep before the first row of the result window, out of the skipped rows. */
    public val skipBufferSize: Int,
) {
    public var buffer: MutableList<D> = mutableListOf()
        internal set
    public val keyDocumentMap: MutableMap<String, D> = HashMap()

    /** Number of matching rows that sort before the first row of the buffer. */
    public var offset: Int = 0
        internal set

    /** True if there are no rows after the last row of the buffer. */
    public var complete: Boolean = false
        internal set
}

/**
 * The skip and limit to run the query of the buffer with.
 * [limit] is null if all rows after the skip are needed.
 */
public data class ResultWindowBufferQuery(val skip: Int, val limit: Int?)

/** What applyChangeEventToResultWindowBuffer() did. */
public enum class ResultWindowBufferResult {
    /** An EventReduce action calculated the new buffer. */
    EventReduce,

    /** EventReduce could not do it (or would have dropped a row), the slice rule did it. */
    Buffer,

    /**
     * The caller must run the query with the skip and limit of
     * getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer().
     */
    RunFullQueryAgain,
    ;

    /** The name as used by the JavaScript implementation. */
    public val jsName: String get() = name.replaceFirstChar { it.lowercaseChar() }
}

/** What applyChangeEventsToResultWindowBuffer() returns. */
public sealed class ResultWindowBufferChangeResult<out D> {
    /** Run the query of getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer(). */
    public object RunFullQueryAgain : ResultWindowBufferChangeResult<Nothing>()

    /**
     * [results] are the rows of the original skip and limit,
     * [changed] is true if they are not the same rows as before the change events.
     */
    public data class Results<D>(val changed: Boolean, val results: List<D>) : ResultWindowBufferChangeResult<D>()
}

/**
 * Actions that keep the length of the result by dropping its first or last row.
 * The slice rule can keep that row instead.
 */
private val ACTIONS_THAT_DROP_A_ROW: Set<ActionName> = setOf(
    ActionName.RemoveFirstItem,
    ActionName.RemoveLastItem,
    ActionName.RemoveFirstInsertLast,
    ActionName.RemoveLastInsertFirst,
    ActionName.RemoveFirstInsertFirst,
    ActionName.RemoveLastInsertLast,
    ActionName.InsertAtSortPositionRemoveLast,
    ActionName.InsertAtSortPositionRemoveFirst,
)

/**
 * The recommended buffer size for each side of the result window.
 * About log2(limit) for small limits, grows faster around limit 400 and is at most 30.
 * Returns 0 for a limit of 1 (like a find-one query) and for queries without a limit.
 */
public fun getRecommendedResultWindowBufferSize(limit: Int?): Int {
    if (limit == null || limit == 0) {
        return 0
    }
    val ratio = 400.0 / limit
    val size = log2(limit.toDouble()) + 19.0 / (1.0 + ratio * ratio)
    return minOf(30, floor(size).toInt())
}

/**
 * Creates an empty result window buffer.
 * Run the query with the skip and limit of getResultWindowBufferQuery()
 * and pass the rows to resetResultWindowBuffer() before using it.
 * [queryParams] has the skip and limit that are shown to the user.
 * [RESULT_WINDOW_BUFFER_ALL_ROWS] keeps all rows on that side.
 * Throws on negative sizes.
 */
public fun <D> createResultWindowBuffer(
    queryParams: QueryParams<D>,
    limitBufferSize: Int = 0,
    skipBufferSize: Int = 0,
): ResultWindowBuffer<D> {
    if (limitBufferSize < 0 || skipBufferSize < 0) {
        throw EventReduceException("RWB_SIZE")
    }
    // with limit 0 the result is always empty, so no rows are kept
    val isEmptyQuery = queryParams.limit == 0
    fun size(size: Int) = if (isEmptyQuery) 0 else minOf(size, MAX_BUFFER_SIZE)
    return ResultWindowBuffer(queryParams, size(limitBufferSize), size(skipBufferSize))
}

private fun getSkip(resultWindowBuffer: ResultWindowBuffer<*>): Int = resultWindowBuffer.queryParams.skip ?: 0

/** The skip and limit to run the query of the buffer with. */
public fun getResultWindowBufferQuery(resultWindowBuffer: ResultWindowBuffer<*>): ResultWindowBufferQuery {
    val skip = getSkip(resultWindowBuffer)
    val bufferSkip = maxOf(0, skip - resultWindowBuffer.skipBufferSize)
    val limit = resultWindowBuffer.queryParams.limit
    val bufferLimit = if (limit != null && resultWindowBuffer.limitBufferSize < MAX_BUFFER_SIZE) {
        val sum = (skip - bufferSkip).toLong() + limit + resultWindowBuffer.limitBufferSize
        if (sum <= Int.MAX_VALUE) sum.toInt() else null
    } else {
        null
    }
    return ResultWindowBufferQuery(bufferSkip, bufferLimit)
}

/**
 * Set the buffer to the rows of a fresh query
 * that ran with the skip and limit of getResultWindowBufferQuery().
 */
public fun <D> resetResultWindowBuffer(resultWindowBuffer: ResultWindowBuffer<D>, rows: List<D>) {
    val query = getResultWindowBufferQuery(resultWindowBuffer)
    val getId = resultWindowBuffer.queryParams.getDocumentId
    resultWindowBuffer.buffer = rows.toMutableList()
    resultWindowBuffer.keyDocumentMap.clear()
    rows.forEach { resultWindowBuffer.keyDocumentMap[getId(it)] = it }
    resultWindowBuffer.offset = query.skip
    // fewer rows than requested means there are no more rows
    resultWindowBuffer.complete = query.limit == null || rows.size < query.limit
}

/**
 * The result that is shown to the user.
 * Throws if the result window is not in the buffer, which happens
 * before resetResultWindowBuffer() was called
 * or when applyChangeEventToResultWindowBuffer() returned RunFullQueryAgain
 * and the query did not run again.
 */
public fun <D> getResultWindowBufferResults(resultWindowBuffer: ResultWindowBuffer<D>): List<D> {
    if (!isResultWindowInBuffer(resultWindowBuffer)) {
        throw EventReduceException("RWB_OUTDATED")
    }
    val buffer = resultWindowBuffer.buffer
    val start = minOf(getSkip(resultWindowBuffer) - resultWindowBuffer.offset, buffer.size)
    val limit = resultWindowBuffer.queryParams.limit
    val end = if (limit == null) buffer.size else minOf(start.toLong() + limit, buffer.size.toLong()).toInt()
    return buffer.subList(start, end).toList()
}

/** Updates the buffer with the change event, mutates the [resultWindowBuffer]. */
public fun <D> applyChangeEventToResultWindowBuffer(
    resultWindowBuffer: ResultWindowBuffer<D>,
    changeEvent: ChangeEvent<D>,
): ResultWindowBufferResult {
    val buffer = resultWindowBuffer.buffer
    val queryParams = resultWindowBuffer.queryParams
    if (queryParams.limit == 0) {
        // the result of a query with limit 0 is always empty, nothing can change it
        return ResultWindowBufferResult.EventReduce
    }
    if (!resultWindowBuffer.complete && buffer.isEmpty()) {
        return ResultWindowBufferResult.RunFullQueryAgain
    }

    /*
     * 1. Let EventReduce handle the buffer as if it was the result of a query
     * with skip = offset and limit = buffer.size. This is exactly true,
     * because the buffer is an exact slice of the full result.
     * If the buffer is complete, we use buffer.size + 1, so EventReduce
     * knows that the limit is not reached and there are no more rows.
     */
    val input = ActionFunctionInput(
        queryParams.copy(
            skip = if (resultWindowBuffer.offset > 0) resultWindowBuffer.offset else null,
            limit = if (resultWindowBuffer.complete) buffer.size + 1 else buffer.size,
        ),
        changeEvent,
        buffer,
        resultWindowBuffer.keyDocumentMap,
    )
    val action = calculateActionName(input)
    val result = if (action == ActionName.RunFullQueryAgain || action in ACTIONS_THAT_DROP_A_ROW) {
        /*
         * 2. EventReduce needs a row before or after the buffer, which it does not know,
         * or it would drop a row to keep the length of the result.
         * But the buffer does not have to keep its length, only to stay an exact slice,
         * so the slice rule lets it shrink or grow instead.
         */
        applySliceRule(resultWindowBuffer, changeEvent)
        ResultWindowBufferResult.Buffer
    } else {
        actionFunction<D>(action)(input)
        ResultWindowBufferResult.EventReduce
    }

    // 3. Do not let the buffer grow without bounds on either side.
    trimBuffer(resultWindowBuffer)

    // 4. Run the query again if the result window does not fit into the buffer anymore.
    if (!isResultWindowInBuffer(resultWindowBuffer)) {
        return ResultWindowBufferResult.RunFullQueryAgain
    }
    return result
}

/**
 * Updates the buffer with all change events.
 * Returns the new results, and if they changed,
 * or RunFullQueryAgain if the result window does not fit into the buffer anymore.
 * Then run the query of getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer().
 * Mutates the [resultWindowBuffer].
 */
public fun <D> applyChangeEventsToResultWindowBuffer(
    resultWindowBuffer: ResultWindowBuffer<D>,
    changeEvents: List<ChangeEvent<D>>,
): ResultWindowBufferChangeResult<D> {
    if (!isResultWindowInBuffer(resultWindowBuffer)) {
        return ResultWindowBufferChangeResult.RunFullQueryAgain
    }
    val previousResults = getResultWindowBufferResults(resultWindowBuffer)
    for (changeEvent in changeEvents) {
        if (applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent) ==
            ResultWindowBufferResult.RunFullQueryAgain
        ) {
            return ResultWindowBufferChangeResult.RunFullQueryAgain
        }
    }
    val results = getResultWindowBufferResults(resultWindowBuffer)
    // Changed rows are always new objects from the change events,
    // so comparing the rows by reference finds every change.
    val changed = results.size != previousResults.size || results.indices.any { results[it] !== previousResults[it] }
    return ResultWindowBufferChangeResult.Results(changed, results)
}

/** True if all rows of the result window are in the buffer. */
private fun isResultWindowInBuffer(resultWindowBuffer: ResultWindowBuffer<*>): Boolean {
    val start = getSkip(resultWindowBuffer) - resultWindowBuffer.offset
    if (start < 0) {
        return false
    }
    if (resultWindowBuffer.complete) {
        return true
    }
    val limit = resultWindowBuffer.queryParams.limit ?: return false
    return resultWindowBuffer.buffer.size >= start.toLong() + limit
}

/**
 * Removes rows before the window that are more than skipBufferSize
 * and rows after the window that are more than limitBufferSize.
 */
private fun <D> trimBuffer(resultWindowBuffer: ResultWindowBuffer<D>) {
    val buffer = resultWindowBuffer.buffer
    val getId = resultWindowBuffer.queryParams.getDocumentId
    fun removeRows(from: Int, to: Int) {
        val removed = buffer.subList(from, to)
        removed.forEach { resultWindowBuffer.keyDocumentMap.remove(getId(it)) }
        removed.clear()
    }

    val rowsBeforeWindow = getSkip(resultWindowBuffer) - resultWindowBuffer.offset
    val removeFromStart = minOf(rowsBeforeWindow - resultWindowBuffer.skipBufferSize, buffer.size)
    if (removeFromStart > 0) {
        removeRows(0, removeFromStart)
        resultWindowBuffer.offset += removeFromStart
    }

    val limit = resultWindowBuffer.queryParams.limit
    if (limit != null) {
        val maxLength = maxOf(0, getSkip(resultWindowBuffer) - resultWindowBuffer.offset).toLong() +
            limit + resultWindowBuffer.limitBufferSize
        if (buffer.size > maxLength) {
            removeRows(maxLength.toInt(), buffer.size)
            resultWindowBuffer.complete = false
        }
    }
}

/**
 * The slice rule:
 * Exactly `offset` matching rows sort before the first row of the buffer,
 * and all matching rows that sort between the first and the last row are in the buffer.
 * After the change event, this is still true for the old first and last row, so:
 * - the old version of the changed row is removed from the buffer,
 * - the new version is added if it sorts between the old first and last row,
 * - offset changes by one if the changed row moved into or out of the rows before the first row.
 * If offset is 0, there are no rows before the first row, so a row that sorts before it is added.
 * If the buffer is complete, there are no rows after the last row, so a row that sorts after it is added.
 *
 * An empty buffer (only valid when complete) knows only the number of rows before it.
 * There, offset is only an upper bound, which stays an upper bound with the same update.
 */
private fun <D> applySliceRule(resultWindowBuffer: ResultWindowBuffer<D>, changeEvent: ChangeEvent<D>) {
    val queryParams = resultWindowBuffer.queryParams
    val buffer = resultWindowBuffer.buffer
    val keyDocumentMap = resultWindowBuffer.keyDocumentMap
    val previous = changeEvent.previous
    val doc = changeEvent.doc
    val wasMatching = previous != null && queryParams.queryMatcher(previous)
    val doesMatchNow = doc != null && queryParams.queryMatcher(doc)

    if (buffer.isEmpty()) {
        if (resultWindowBuffer.offset == 0) {
            // there are no rows at all
            if (doc != null && doesMatchNow) {
                insertAtSortPosition(resultWindowBuffer, doc)
            }
        } else {
            resultWindowBuffer.offset += (if (doesMatchNow) 1 else 0) - (if (wasMatching) 1 else 0)
        }
        return
    }

    val first = buffer.first()
    val last = buffer.last()
    val hasRowsBefore = resultWindowBuffer.offset > 0
    val isBefore = { d: D -> hasRowsBefore && compareRows(queryParams, d, first) < 0 }
    val wasBefore = previous != null && wasMatching && isBefore(previous)
    val isBeforeNow = doc != null && doesMatchNow && isBefore(doc)

    val id = changeEvent.id
    if (keyDocumentMap.remove(id) != null) {
        buffer.removeAt(indexOfDocumentId(queryParams, buffer, id))
    }
    if (doc != null &&
        doesMatchNow &&
        !isBeforeNow &&
        (resultWindowBuffer.complete || compareRows(queryParams, doc, last) <= 0)
    ) {
        insertAtSortPosition(resultWindowBuffer, doc)
    }
    resultWindowBuffer.offset += (if (isBeforeNow) 1 else 0) - (if (wasBefore) 1 else 0)
}

/**
 * Compares two rows with the sort comparator of the query.
 * Returns 0 only for two versions of the same row that sort at the same position.
 * For different rows that the comparator sees as equal,
 * the primary key decides, so that the order is always deterministic.
 */
private fun <D> compareRows(queryParams: QueryParams<D>, a: D, b: D): Int {
    val idA = queryParams.getDocumentId(a)
    val idB = queryParams.getDocumentId(b)
    val result = queryParams.sortComparator.compare(a, b).sign
    if (idA == idB) {
        // A deterministic comparator breaks ties by the primary key,
        // which gives the same answer for both directions when the sort values are equal.
        if (result == 0 || result == queryParams.sortComparator.compare(b, a).sign) {
            return 0
        }
        return result
    }
    if (result != 0) {
        return result
    }
    return idA.compareTo(idB)
}

/**
 * compareRows() returns 0 only for two versions of the same row,
 * and the old version was removed before, so the position is exact.
 */
private fun <D> insertAtSortPosition(resultWindowBuffer: ResultWindowBuffer<D>, doc: D) {
    val queryParams = resultWindowBuffer.queryParams
    pushAtSortPosition(resultWindowBuffer.buffer, doc) { a, b -> compareRows(queryParams, a, b) }
    resultWindowBuffer.keyDocumentMap[queryParams.getDocumentId(doc)] = doc
}
