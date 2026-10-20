import 'types.dart';
import 'util.dart';

typedef ActionFunction<D> = void Function(ActionFunctionInput<D> input);

/// All actions, in the same order as the JavaScript implementation.
/// The BDD references the actions by their index in this list.
const List<ActionName> orderedActionList = ActionName.values;

/// Returns the function of the given action.
/// alwaysWrong is only used by the truth-table generator and never
/// returned by the BDD, so it is mapped to unknownAction here.
ActionFunction<D> actionFunction<D>(ActionName action) {
  switch (action) {
    case ActionName.doNothing:
      return doNothing;
    case ActionName.insertFirst:
      return insertFirst;
    case ActionName.insertLast:
      return insertLast;
    case ActionName.removeFirstItem:
      return removeFirstItem;
    case ActionName.removeLastItem:
      return removeLastItem;
    case ActionName.removeFirstInsertLast:
      return removeFirstInsertLast;
    case ActionName.removeLastInsertFirst:
      return removeLastInsertFirst;
    case ActionName.removeFirstInsertFirst:
      return removeFirstInsertFirst;
    case ActionName.removeLastInsertLast:
      return removeLastInsertLast;
    case ActionName.removeExisting:
      return removeExisting;
    case ActionName.replaceExisting:
      return replaceExisting;
    case ActionName.alwaysWrong:
      return unknownAction;
    case ActionName.insertAtSortPosition:
      return insertAtSortPosition;
    case ActionName.removeExistingAndInsertAtSortPosition:
      return removeExistingAndInsertAtSortPosition;
    case ActionName.runFullQueryAgain:
      return runFullQueryAgain;
    case ActionName.unknownAction:
      return unknownAction;
  }
}

/// Returns the index of the changed document inside of the previous results
/// or -1 if it is not found.
int _findIndexOfChangedDoc<D>(ActionFunctionInput<D> input) {
  final id = input.changeEvent.id;
  final map = input.keyDocumentMap;
  if (map != null && !map.containsKey(id)) {
    return -1;
  }
  return indexOfDocumentId(input.queryParams, input.previousResults, id);
}

/// The new document of the change event.
/// Only the BDD knows that it exists for the given action.
D _changedDoc<D>(ActionFunctionInput<D> input) {
  final doc = input.changeEvent.doc;
  if (doc == null) {
    throw EventReduceError('UNK_ACT');
  }
  return doc;
}

void doNothing<D>(ActionFunctionInput<D> input) {}

void insertFirst<D>(ActionFunctionInput<D> input) {
  final doc = _changedDoc(input);
  input.previousResults.insert(0, doc);
  input.keyDocumentMap?[input.changeEvent.id] = doc;
}

void insertLast<D>(ActionFunctionInput<D> input) {
  final doc = _changedDoc(input);
  input.previousResults.add(doc);
  input.keyDocumentMap?[input.changeEvent.id] = doc;
}

void removeFirstItem<D>(ActionFunctionInput<D> input) {
  if (input.previousResults.isEmpty) {
    return;
  }
  final first = input.previousResults.removeAt(0);
  input.keyDocumentMap?.remove(input.queryParams.getDocumentId(first));
}

void removeLastItem<D>(ActionFunctionInput<D> input) {
  if (input.previousResults.isEmpty) {
    return;
  }
  final last = input.previousResults.removeLast();
  input.keyDocumentMap?.remove(input.queryParams.getDocumentId(last));
}

void removeFirstInsertLast<D>(ActionFunctionInput<D> input) {
  removeFirstItem(input);
  insertLast(input);
}

void removeLastInsertFirst<D>(ActionFunctionInput<D> input) {
  removeLastItem(input);
  insertFirst(input);
}

void removeFirstInsertFirst<D>(ActionFunctionInput<D> input) {
  removeFirstItem(input);
  insertFirst(input);
}

void removeLastInsertLast<D>(ActionFunctionInput<D> input) {
  removeLastItem(input);
  insertLast(input);
}

void removeExisting<D>(ActionFunctionInput<D> input) {
  final index = _findIndexOfChangedDoc(input);
  input.keyDocumentMap?.remove(input.changeEvent.id);
  if (index >= 0) {
    input.previousResults.removeAt(index);
  }
}

void replaceExisting<D>(ActionFunctionInput<D> input) {
  final index = _findIndexOfChangedDoc(input);
  if (index >= 0) {
    final doc = _changedDoc(input);
    input.previousResults[index] = doc;
    input.keyDocumentMap?[input.changeEvent.id] = doc;
  }
}

void insertAtSortPosition<D>(ActionFunctionInput<D> input) {
  final doc = _changedDoc(input);
  final id = input.changeEvent.id;
  final map = input.keyDocumentMap;
  /*
   * If document is already in results,
   * we cannot add it again because it would throw on non-deterministic ordering.
   */
  final isDocInResults = map != null
      ? map.containsKey(id)
      : indexOfDocumentId(input.queryParams, input.previousResults, id) >= 0;
  if (isDocInResults) {
    return;
  }
  map?[id] = doc;
  pushAtSortPosition(
    input.previousResults,
    doc,
    input.queryParams.sortComparator,
  );
}

void removeExistingAndInsertAtSortPosition<D>(ActionFunctionInput<D> input) {
  removeExisting(input);
  insertAtSortPosition(input);
}

void runFullQueryAgain<D>(ActionFunctionInput<D> input) {
  throw EventReduceError('RUN_FULL');
}

void unknownAction<D>(ActionFunctionInput<D> input) {
  throw EventReduceError('UNK_ACT');
}
