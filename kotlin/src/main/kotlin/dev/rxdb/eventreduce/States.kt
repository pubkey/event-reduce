package dev.rxdb.eventreduce

/**
 * All states, in the same order as the JavaScript implementation.
 * The BDD references the states by their index in this list.
 */
public val orderedStateList: List<StateName> = StateName.entries

public fun <D> hasLimit(input: StateResolveFunctionInput<D>): Boolean =
    input.queryParams.limit.let { it != null && it > 0 }

public fun <D> isFindOne(input: StateResolveFunctionInput<D>): Boolean = input.queryParams.limit == 1

public fun <D> hasSkip(input: StateResolveFunctionInput<D>): Boolean =
    input.queryParams.skip.let { it != null && it > 0 }

public fun <D> isDelete(input: StateResolveFunctionInput<D>): Boolean = input.changeEvent is ChangeEvent.Delete

public fun <D> isInsert(input: StateResolveFunctionInput<D>): Boolean = input.changeEvent is ChangeEvent.Insert

public fun <D> isUpdate(input: StateResolveFunctionInput<D>): Boolean = input.changeEvent is ChangeEvent.Update

public fun <D> wasLimitReached(input: StateResolveFunctionInput<D>): Boolean =
    input.queryParams.limit.let { it != null && it > 0 && input.previousResults.size >= it }

public fun <D> sortParamsChanged(input: StateResolveFunctionInput<D>): Boolean {
    val doc = input.changeEvent.doc ?: return false
    val prev = input.changeEvent.previous ?: return true
    return input.queryParams.sortFieldsChanged(prev, doc)
}

public fun <D> wasInResult(input: StateResolveFunctionInput<D>): Boolean {
    val id = input.changeEvent.id
    val map = input.keyDocumentMap
    return map?.containsKey(id) ?: (indexOfDocumentId(input.queryParams, input.previousResults, id) >= 0)
}

public fun <D> wasFirst(input: StateResolveFunctionInput<D>): Boolean {
    val first = input.previousResults.firstOrNull() ?: return false
    return input.queryParams.getDocumentId(first) == input.changeEvent.id
}

public fun <D> wasLast(input: StateResolveFunctionInput<D>): Boolean {
    val last = input.previousResults.lastOrNull() ?: return false
    return input.queryParams.getDocumentId(last) == input.changeEvent.id
}

/**
 * Compares the given document with the first or last result item.
 * If the changed document is the result item itself,
 * we cannot sort-compare them, because it might end in a non-deterministic
 * sort order. Because both document could be equal.
 * So instead we have to return true.
 */
private inline fun <D> compareWithResult(
    input: StateResolveFunctionInput<D>,
    doc: D?,
    first: Boolean,
    expected: (Int) -> Boolean,
): Boolean {
    if (doc == null || input.previousResults.isEmpty()) {
        return false
    }
    val resultItem = if (first) input.previousResults.first() else input.previousResults.last()
    if (input.queryParams.getDocumentId(resultItem) == input.changeEvent.id) {
        return true
    }
    return expected(input.queryParams.sortComparator.compare(doc, resultItem))
}

public fun <D> wasSortedBeforeFirst(input: StateResolveFunctionInput<D>): Boolean =
    compareWithResult(input, input.changeEvent.previous, true) { it < 0 }

public fun <D> wasSortedAfterLast(input: StateResolveFunctionInput<D>): Boolean =
    compareWithResult(input, input.changeEvent.previous, false) { it > 0 }

/**
 * Like [compareWithResult], but if the changed document is the result item itself,
 * it compares with the neighbor of the result item instead,
 * so we know if the changed document still sorts first or last.
 * If there is no neighbor, the changed document is still first or last.
 */
private inline fun <D> compareNewDocWithResult(
    input: StateResolveFunctionInput<D>,
    first: Boolean,
    expected: (Int) -> Boolean,
): Boolean {
    val doc = input.changeEvent.doc
    val results = input.previousResults
    if (doc == null || results.isEmpty()) {
        return false
    }
    var resultItem = if (first) results.first() else results.last()
    if (input.queryParams.getDocumentId(resultItem) == input.changeEvent.id) {
        if (results.size < 2) {
            return true
        }
        resultItem = if (first) results[1] else results[results.size - 2]
    }
    return expected(input.queryParams.sortComparator.compare(doc, resultItem))
}

public fun <D> isSortedBeforeFirst(input: StateResolveFunctionInput<D>): Boolean =
    compareNewDocWithResult(input, true) { it < 0 }

public fun <D> isSortedAfterLast(input: StateResolveFunctionInput<D>): Boolean =
    compareNewDocWithResult(input, false) { it > 0 }

public fun <D> wasMatching(input: StateResolveFunctionInput<D>): Boolean {
    val prev = input.changeEvent.previous ?: return false
    return input.queryParams.queryMatcher(prev)
}

public fun <D> doesMatchNow(input: StateResolveFunctionInput<D>): Boolean {
    val doc = input.changeEvent.doc ?: return false
    return input.queryParams.queryMatcher(doc)
}

public fun <D> wasResultsEmpty(input: StateResolveFunctionInput<D>): Boolean = input.previousResults.isEmpty()

/** Resolves the state with the given index in [orderedStateList]. */
public fun <D> resolveStateByIndex(index: Int, input: StateResolveFunctionInput<D>): Boolean =
    when (index) {
        0 -> isInsert(input)
        1 -> isUpdate(input)
        2 -> isDelete(input)
        3 -> hasLimit(input)
        4 -> isFindOne(input)
        5 -> hasSkip(input)
        6 -> wasResultsEmpty(input)
        7 -> wasLimitReached(input)
        8 -> wasFirst(input)
        9 -> wasLast(input)
        10 -> sortParamsChanged(input)
        11 -> wasInResult(input)
        12 -> wasSortedBeforeFirst(input)
        13 -> wasSortedAfterLast(input)
        14 -> isSortedBeforeFirst(input)
        15 -> isSortedAfterLast(input)
        16 -> wasMatching(input)
        17 -> doesMatchNow(input)
        else -> throw EventReduceException("UNK_STATE $index")
    }

public fun <D> resolveState(state: StateName, input: StateResolveFunctionInput<D>): Boolean =
    resolveStateByIndex(state.ordinal, input)

/**
 * Returns the binary representation of all states
 * like '010110110111...' where the first '0' means that the first state is false.
 */
public fun <D> getStateSet(input: StateResolveFunctionInput<D>): String =
    orderedStateList.joinToString("") { if (resolveState(it, input)) "1" else "0" }
