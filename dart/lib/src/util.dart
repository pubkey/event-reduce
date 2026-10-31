import 'types.dart';

/// Returns the index of the document with the given id
/// or -1 if it is not in the given documents.
int indexOfDocumentId<D>(QueryParams<D> queryParams, List<D> docs, String id) {
  final getId = queryParams.getDocumentId;
  return docs.indexWhere((doc) => getId(doc) == id);
}

/// Inserts the item at its sort position, which is much faster than re-sorting the list.
/// Items that are equal to the new item stay before it.
void pushAtSortPosition<D>(
  List<D> list,
  D item,
  int Function(D a, D b) compare,
) {
  // Shortcut: the item belongs at the end, add() is O(1).
  if (list.isEmpty || compare(list.last, item) <= 0) {
    list.add(item);
    return;
  }
  var low = 0;
  var high = list.length;
  while (low < high) {
    final mid = (low + high) >> 1;
    if (compare(list[mid], item) <= 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  list.insert(low, item);
}
