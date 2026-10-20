enum WriteOperation { insert, update, delete }

/// A write event on the database.
/// [id] is the value of the primary key of the changed document.
class ChangeEvent<D> {
  final WriteOperation operation;
  final String id;

  /// The document after the write, null on deletes.
  final D? doc;

  /// The document before the write, null on inserts.
  final D? previous;

  const ChangeEvent.insert({required this.id, required D this.doc})
      : operation = WriteOperation.insert,
        previous = null;

  const ChangeEvent.update({
    required this.id,
    required D this.doc,
    required D this.previous,
  }) : operation = WriteOperation.update;

  const ChangeEvent.delete({required this.id, required D this.previous})
      : operation = WriteOperation.delete,
        doc = null;

  @override
  String toString() =>
      'ChangeEvent(${operation.name}, id: $id, doc: $doc, previous: $previous)';
}

typedef QueryMatcher<D> = bool Function(D doc);

/// To have a deterministic sorting, the comparator must never return 0
/// for two different documents, only a negative or a positive number.
/// Use the primary key as last sort field to ensure that.
typedef DeterministicSortComparator<D> = int Function(D a, D b);

/// Map from the id of each document in the results to the document.
typedef ResultKeyDocumentMap<D> = Map<String, D>;

/// Describes the query whose results are kept up to date.
class QueryParams<D> {
  /// Returns the id of a document.
  /// Must return the same value as the id of the change events.
  final String Function(D doc) getDocumentId;
  final int? skip;
  final int? limit;
  final QueryMatcher<D> queryMatcher;
  final DeterministicSortComparator<D> sortComparator;

  /// Returns true if any of the fields that the query sorts by
  /// differs between the previous and the new version of a document.
  final bool Function(D previous, D doc) sortFieldsChanged;

  const QueryParams({
    required this.getDocumentId,
    this.skip,
    this.limit,
    required this.queryMatcher,
    required this.sortComparator,
    required this.sortFieldsChanged,
  });
}

/// The input of the state functions and of the action functions.
/// Action functions mutate [previousResults] and [keyDocumentMap].
class StateResolveFunctionInput<D> {
  final QueryParams<D> queryParams;
  final ChangeEvent<D> changeEvent;
  final List<D> previousResults;
  final ResultKeyDocumentMap<D>? keyDocumentMap;

  const StateResolveFunctionInput({
    required this.queryParams,
    required this.changeEvent,
    required this.previousResults,
    this.keyDocumentMap,
  });
}

typedef ActionFunctionInput<D> = StateResolveFunctionInput<D>;

enum ActionName {
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

  /// Only used by the truth-table generator, never returned by the BDD.
  alwaysWrong,
  insertAtSortPosition,
  removeExistingAndInsertAtSortPosition,
  runFullQueryAgain,

  /// If a state was never reached, we do not know the correct action.
  unknownAction,
}

enum StateName {
  isInsert,
  isUpdate,
  isDelete,
  hasLimit,
  isFindOne,
  hasSkip,
  wasResultsEmpty,
  wasLimitReached,
  wasFirst,
  wasLast,
  sortParamsChanged,
  wasInResult,
  wasSortedBeforeFirst,
  wasSortedAfterLast,
  isSortedBeforeFirst,
  isSortedAfterLast,
  wasMatching,
  doesMatchNow,
}

/// Thrown by runAction() for the actions that cannot be applied to the results.
class EventReduceError extends Error {
  final String code;
  EventReduceError(this.code);

  @override
  String toString() => 'EventReduce:$code';
}
