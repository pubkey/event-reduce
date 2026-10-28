package dev.rxdb.eventreduce

/**
 * Returns the index of the document with the given id
 * or -1 if it is not in the given documents.
 */
public fun <D> indexOfDocumentId(queryParams: QueryParams<D>, docs: List<D>, id: String): Int =
    docs.indexOfFirst { queryParams.getDocumentId(it) == id }

/**
 * Inserts the item at its sort position, which is much faster than re-sorting the list.
 * Items that are equal to the new item stay before it.
 */
public fun <D> pushAtSortPosition(list: MutableList<D>, item: D, comparator: Comparator<D>) {
    // Shortcut: the item belongs at the end, add() is O(1).
    if (list.isEmpty() || comparator.compare(list.last(), item) <= 0) {
        list.add(item)
        return
    }
    // The search never reports a match, so it returns (-insertionPoint - 1),
    // where insertionPoint is the index of the first item that sorts after the new item.
    val insertionPoint = -(list.binarySearch { if (comparator.compare(it, item) <= 0) -1 else 1 } + 1)
    list.add(insertionPoint, item)
}
