package com.github.pubkey.eventreduce

/**
 * Returns the index of the document with the given id
 * or -1 if it is not in the given documents.
 */
public fun <D> indexOfDocumentId(queryParams: QueryParams<D>, docs: List<D>, id: String): Int {
    val getId = queryParams.getDocumentId
    for (i in docs.indices) {
        if (getId(docs[i]) == id) {
            return i
        }
    }
    return -1
}

/**
 * Inserts the item at its sort position, which is much faster than re-sorting the list.
 * Items that are equal to the new item stay before it.
 * Returns the index at which the item was inserted.
 */
public fun <D> pushAtSortPosition(list: MutableList<D>, item: D, comparator: Comparator<D>): Int {
    // Shortcut: the item belongs at the end, add() is O(1).
    if (list.isEmpty() || comparator.compare(list.last(), item) <= 0) {
        list.add(item)
        return list.size - 1
    }
    var low = 0
    var high = list.size
    while (low < high) {
        val mid = (low + high) ushr 1
        if (comparator.compare(list[mid], item) <= 0) {
            low = mid + 1
        } else {
            high = mid
        }
    }
    list.add(low, item)
    return low
}
