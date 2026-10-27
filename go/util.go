package eventreduce

import "slices"

// IndexOfDocumentID returns the index of the document with the given id
// or -1 if it is not in the given documents.
func IndexOfDocumentID[D any](queryParams QueryParams[D], docs []D, id string) int {
	return slices.IndexFunc(docs, func(doc D) bool { return queryParams.GetDocumentID(doc) == id })
}

// PushAtSortPosition inserts the item at its sort position,
// which is much faster than re-sorting the slice.
// Items that are equal to the new item stay before it.
// Like append(), the returned slice can share memory with items.
func PushAtSortPosition[D any](items []D, item D, compare func(a, b D) int) []D {
	// Shortcut: the item belongs at the end, append() is O(1).
	if len(items) == 0 || compare(items[len(items)-1], item) <= 0 {
		return append(items, item)
	}
	// binary search for the first item that sorts after the new item
	index, _ := slices.BinarySearchFunc(items, item, func(a, b D) int {
		if compare(a, b) <= 0 {
			return -1
		}
		return 1
	})
	return slices.Insert(items, index, item)
}
