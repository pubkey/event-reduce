package eventreduce

// IndexOfDocumentID returns the index of the document with the given id
// or -1 if it is not in the given documents.
func IndexOfDocumentID[D any](queryParams QueryParams[D], docs []D, id string) int {
	for i, doc := range docs {
		if queryParams.GetDocumentID(doc) == id {
			return i
		}
	}
	return -1
}

// PushAtSortPosition inserts the item at its sort position,
// which is much faster than re-sorting the slice.
// Items that are equal to the new item stay before it.
// Returns the new slice and the index at which the item was inserted.
func PushAtSortPosition[D any](items []D, item D, compare func(a, b D) int) ([]D, int) {
	// Shortcut: the item belongs at the end, append() is O(1).
	if len(items) == 0 || compare(items[len(items)-1], item) <= 0 {
		return append(items, item), len(items)
	}
	low, high := 0, len(items)
	for low < high {
		mid := int(uint(low+high) >> 1)
		if compare(items[mid], item) <= 0 {
			low = mid + 1
		} else {
			high = mid
		}
	}
	return insertAt(items, low, item), low
}

func insertAt[D any](items []D, index int, item D) []D {
	var zero D
	items = append(items, zero)
	copy(items[index+1:], items[index:])
	items[index] = item
	return items
}

func removeAt[D any](items []D, index int) []D {
	copy(items[index:], items[index+1:])
	var zero D
	items[len(items)-1] = zero
	return items[:len(items)-1]
}
