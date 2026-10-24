/// Returns the index of the document with the given id
/// or nil if it is not in the given documents.
public func indexOfDocumentId<D>(_ queryParams: QueryParams<D>, _ docs: [D], _ id: String) -> Int? {
    let getId = queryParams.getDocumentId
    return docs.firstIndex { getId($0) == id }
}

/// Inserts the item at its sort position, which is much faster than re-sorting the array.
/// Items that are equal to the new item stay before it.
/// Returns the index at which the item was inserted.
@discardableResult
public func pushAtSortPosition<D>(
    _ array: inout [D],
    _ item: D,
    by areInIncreasingOrder: (D, D) -> Bool
) -> Int {
    // Shortcut: the item belongs at the end, append() is O(1).
    if let last = array.last, areInIncreasingOrder(item, last) {
        var low = 0
        var high = array.count
        while low < high {
            let mid = (low + high) / 2
            if areInIncreasingOrder(item, array[mid]) {
                high = mid
            } else {
                low = mid + 1
            }
        }
        array.insert(item, at: low)
        return low
    }
    array.append(item)
    return array.count - 1
}
