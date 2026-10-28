package dev.rxdb.eventreduce

public typealias ActionFunction<D> = (ActionFunctionInput<D>) -> Unit

/**
 * All actions, in the same order as the JavaScript implementation.
 * The BDD references the actions by their index in this list.
 */
public val orderedActionList: List<ActionName> = ActionName.entries

/**
 * Returns the function of the given action.
 * AlwaysWrong is only used by the truth-table generator and never
 * returned by the BDD, so it is mapped to unknownAction here.
 */
public fun <D> actionFunction(action: ActionName): ActionFunction<D> =
    when (action) {
        ActionName.DoNothing -> ::doNothing
        ActionName.InsertFirst -> ::insertFirst
        ActionName.InsertLast -> ::insertLast
        ActionName.RemoveFirstItem -> ::removeFirstItem
        ActionName.RemoveLastItem -> ::removeLastItem
        ActionName.RemoveFirstInsertLast -> ::removeFirstInsertLast
        ActionName.RemoveLastInsertFirst -> ::removeLastInsertFirst
        ActionName.RemoveFirstInsertFirst -> ::removeFirstInsertFirst
        ActionName.RemoveLastInsertLast -> ::removeLastInsertLast
        ActionName.RemoveExisting -> ::removeExisting
        ActionName.ReplaceExisting -> ::replaceExisting
        ActionName.AlwaysWrong -> ::unknownAction
        ActionName.InsertAtSortPosition -> ::insertAtSortPosition
        ActionName.RemoveExistingAndInsertAtSortPosition -> ::removeExistingAndInsertAtSortPosition
        ActionName.InsertAtSortPositionRemoveLast -> ::insertAtSortPositionRemoveLast
        ActionName.InsertAtSortPositionRemoveFirst -> ::insertAtSortPositionRemoveFirst
        ActionName.RunFullQueryAgain -> ::runFullQueryAgain
        ActionName.UnknownAction -> ::unknownAction
    }

/** Returns the index of the changed document inside of the previous results or -1. */
private fun <D> findIndexOfChangedDoc(input: ActionFunctionInput<D>): Int {
    val id = input.changeEvent.id
    val map = input.keyDocumentMap
    if (map != null && !map.containsKey(id)) {
        return -1
    }
    return indexOfDocumentId(input.queryParams, input.previousResults, id)
}

/**
 * The new document of the change event.
 * Only the BDD knows that it exists for the given action.
 */
private fun <D> changedDoc(input: ActionFunctionInput<D>): D =
    input.changeEvent.doc ?: throw EventReduceException("UNK_ACT")

public fun <D> doNothing(@Suppress("UNUSED_PARAMETER") input: ActionFunctionInput<D>) {}

public fun <D> insertFirst(input: ActionFunctionInput<D>) {
    val doc = changedDoc(input)
    input.previousResults.add(0, doc)
    input.keyDocumentMap?.put(input.changeEvent.id, doc)
}

public fun <D> insertLast(input: ActionFunctionInput<D>) {
    val doc = changedDoc(input)
    input.previousResults.add(doc)
    input.keyDocumentMap?.put(input.changeEvent.id, doc)
}

public fun <D> removeFirstItem(input: ActionFunctionInput<D>) {
    input.previousResults.removeFirstOrNull()?.let { input.keyDocumentMap?.remove(input.queryParams.getDocumentId(it)) }
}

public fun <D> removeLastItem(input: ActionFunctionInput<D>) {
    input.previousResults.removeLastOrNull()?.let { input.keyDocumentMap?.remove(input.queryParams.getDocumentId(it)) }
}

public fun <D> removeFirstInsertLast(input: ActionFunctionInput<D>) {
    removeFirstItem(input)
    insertLast(input)
}

public fun <D> removeLastInsertFirst(input: ActionFunctionInput<D>) {
    removeLastItem(input)
    insertFirst(input)
}

public fun <D> removeFirstInsertFirst(input: ActionFunctionInput<D>) {
    removeFirstItem(input)
    insertFirst(input)
}

public fun <D> removeLastInsertLast(input: ActionFunctionInput<D>) {
    removeLastItem(input)
    insertLast(input)
}

public fun <D> removeExisting(input: ActionFunctionInput<D>) {
    val index = findIndexOfChangedDoc(input)
    input.keyDocumentMap?.remove(input.changeEvent.id)
    if (index >= 0) {
        input.previousResults.removeAt(index)
    }
}

public fun <D> replaceExisting(input: ActionFunctionInput<D>) {
    val index = findIndexOfChangedDoc(input)
    if (index >= 0) {
        val doc = changedDoc(input)
        input.previousResults[index] = doc
        input.keyDocumentMap?.put(input.changeEvent.id, doc)
    }
}

public fun <D> insertAtSortPosition(input: ActionFunctionInput<D>) {
    val doc = changedDoc(input)
    val id = input.changeEvent.id
    val map = input.keyDocumentMap
    /*
     * If document is already in results,
     * we cannot add it again because it would throw on non-deterministic ordering.
     */
    val isDocInResults = map?.containsKey(id)
        ?: (indexOfDocumentId(input.queryParams, input.previousResults, id) >= 0)
    if (isDocInResults) {
        return
    }
    map?.put(id, doc)
    pushAtSortPosition(input.previousResults, doc, input.queryParams.sortComparator)
}

public fun <D> removeExistingAndInsertAtSortPosition(input: ActionFunctionInput<D>) {
    removeExisting(input)
    insertAtSortPosition(input)
}

/**
 * Inserts the document at its sort position and then removes a document with [remove].
 * insertAtSortPosition() does nothing if the document is already in the results,
 * then nothing is removed.
 */
private inline fun <D> insertAtSortPositionAndRemove(input: ActionFunctionInput<D>, remove: (ActionFunctionInput<D>) -> Unit) {
    val sizeBefore = input.previousResults.size
    insertAtSortPosition(input)
    if (input.previousResults.size > sizeBefore) {
        remove(input)
    }
}

/**
 * Inserts the document at its sort position and then removes the last document.
 * Used when the limit was reached and the new document
 * sorts in between the first and the last document,
 * so the previous last document is pushed out of the results.
 */
public fun <D> insertAtSortPositionRemoveLast(input: ActionFunctionInput<D>): Unit =
    insertAtSortPositionAndRemove(input, ::removeLastItem)

/**
 * Inserts the document at its sort position and then removes the first document.
 * Used when a document moves out of the skipped documents into the results,
 * so the previous first document is pushed into the skipped documents.
 */
public fun <D> insertAtSortPositionRemoveFirst(input: ActionFunctionInput<D>): Unit =
    insertAtSortPositionAndRemove(input, ::removeFirstItem)

public fun <D> runFullQueryAgain(@Suppress("UNUSED_PARAMETER") input: ActionFunctionInput<D>) {
    throw EventReduceException("RUN_FULL")
}

public fun <D> unknownAction(@Suppress("UNUSED_PARAMETER") input: ActionFunctionInput<D>) {
    throw EventReduceException("UNK_ACT")
}
