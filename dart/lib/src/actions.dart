import 'bdd.dart';
import 'types.dart';
import 'util.dart';

typedef ActionFunction<D> = void Function(StateResolveFunctionInput<D> input);

/// All actions, in the same order as the JavaScript implementation.
/// The BDD references the actions by their index in this list.
const List<ActionName> orderedActionList = ActionName.values;

/// Returns the action that transforms the previous results into the new results.
/// If it is [ActionName.runFullQueryAgain], the query must be run over the database again.
ActionName calculateActionName<D>(StateResolveFunctionInput<D> input) =>
    orderedActionList[resolveInput(input)];

/// The functions of the actions, indexed by [ActionName.index].
/// alwaysWrong is only used by the truth-table generator and never
/// returned by the BDD, so it is mapped to unknownAction here.
const List<void Function<D>(StateResolveFunctionInput<D> input)>
_actionFunctions = [
  doNothing,
  insertFirst,
  insertLast,
  removeFirstItem,
  removeLastItem,
  removeFirstInsertLast,
  removeLastInsertFirst,
  removeFirstInsertFirst,
  removeLastInsertLast,
  removeExisting,
  replaceExisting,
  unknownAction, // alwaysWrong
  insertAtSortPosition,
  removeExistingAndInsertAtSortPosition,
  insertAtSortPositionRemoveLast,
  insertAtSortPositionRemoveFirst,
  runFullQueryAgain,
  unknownAction,
];

/// Returns the function of the given action.
ActionFunction<D> actionFunction<D>(ActionName action) =>
    _actionFunctions[action.index]<D>;

/// Returns the index of the changed document inside of the previous results
/// or -1 if it is not found.
int _findIndexOfChangedDoc<D>(StateResolveFunctionInput<D> input) {
  final id = input.changeEvent.id;
  final map = input.keyDocumentMap;
  if (map != null && !map.containsKey(id)) {
    return -1;
  }
  return indexOfDocumentId(input.queryParams, input.previousResults, id);
}

/// The new document of the change event.
/// Only the BDD knows that it exists for the given action.
D _changedDoc<D>(StateResolveFunctionInput<D> input) {
  final doc = input.changeEvent.doc;
  if (doc == null) {
    throw EventReduceError('UNK_ACT');
  }
  return doc;
}

void doNothing<D>(StateResolveFunctionInput<D> input) {}

void insertFirst<D>(StateResolveFunctionInput<D> input) {
  final doc = _changedDoc(input);
  input.previousResults.insert(0, doc);
  input.keyDocumentMap?[input.changeEvent.id] = doc;
}

void insertLast<D>(StateResolveFunctionInput<D> input) {
  final doc = _changedDoc(input);
  input.previousResults.add(doc);
  input.keyDocumentMap?[input.changeEvent.id] = doc;
}

void removeFirstItem<D>(StateResolveFunctionInput<D> input) {
  if (input.previousResults.isEmpty) {
    return;
  }
  final first = input.previousResults.removeAt(0);
  input.keyDocumentMap?.remove(input.queryParams.getDocumentId(first));
}

void removeLastItem<D>(StateResolveFunctionInput<D> input) {
  if (input.previousResults.isEmpty) {
    return;
  }
  final last = input.previousResults.removeLast();
  input.keyDocumentMap?.remove(input.queryParams.getDocumentId(last));
}

void removeFirstInsertLast<D>(StateResolveFunctionInput<D> input) {
  removeFirstItem(input);
  insertLast(input);
}

void removeLastInsertFirst<D>(StateResolveFunctionInput<D> input) {
  removeLastItem(input);
  insertFirst(input);
}

void removeFirstInsertFirst<D>(StateResolveFunctionInput<D> input) {
  removeFirstItem(input);
  insertFirst(input);
}

void removeLastInsertLast<D>(StateResolveFunctionInput<D> input) {
  removeLastItem(input);
  insertLast(input);
}

void removeExisting<D>(StateResolveFunctionInput<D> input) {
  final index = _findIndexOfChangedDoc(input);
  input.keyDocumentMap?.remove(input.changeEvent.id);
  if (index >= 0) {
    input.previousResults.removeAt(index);
  }
}

void replaceExisting<D>(StateResolveFunctionInput<D> input) {
  final index = _findIndexOfChangedDoc(input);
  if (index >= 0) {
    final doc = _changedDoc(input);
    input.previousResults[index] = doc;
    input.keyDocumentMap?[input.changeEvent.id] = doc;
  }
}

void insertAtSortPosition<D>(StateResolveFunctionInput<D> input) {
  final doc = _changedDoc(input);
  final id = input.changeEvent.id;
  final map = input.keyDocumentMap;
  /*
   * If document is already in results,
   * we cannot add it again because it would throw on non-deterministic ordering.
   */
  final isDocInResults =
      map != null
          ? map.containsKey(id)
          : indexOfDocumentId(input.queryParams, input.previousResults, id) >=
              0;
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

void removeExistingAndInsertAtSortPosition<D>(
  StateResolveFunctionInput<D> input,
) {
  removeExisting(input);
  insertAtSortPosition(input);
}

/// Inserts the document at its sort position and,
/// if it was inserted, removes a document with [remove].
void _insertAtSortPositionAndRemove<D>(
  StateResolveFunctionInput<D> input,
  void Function(StateResolveFunctionInput<D> input) remove,
) {
  final lengthBefore = input.previousResults.length;
  insertAtSortPosition(input);
  // insertAtSortPosition() does nothing if the document is already in the results
  if (input.previousResults.length > lengthBefore) {
    remove(input);
  }
}

/// Inserts the document at its sort position and then removes the last document.
/// Used when the limit was reached and the new document
/// sorts in between the first and the last document,
/// so the previous last document is pushed out of the results.
void insertAtSortPositionRemoveLast<D>(StateResolveFunctionInput<D> input) =>
    _insertAtSortPositionAndRemove<D>(input, removeLastItem);

/// Inserts the document at its sort position and then removes the first document.
/// Used when a document moves out of the skipped documents into the results,
/// so the previous first document is pushed into the skipped documents.
void insertAtSortPositionRemoveFirst<D>(StateResolveFunctionInput<D> input) =>
    _insertAtSortPositionAndRemove<D>(input, removeFirstItem);

void runFullQueryAgain<D>(StateResolveFunctionInput<D> input) {
  throw EventReduceError('RUN_FULL');
}

void unknownAction<D>(StateResolveFunctionInput<D> input) {
  throw EventReduceError('UNK_ACT');
}
