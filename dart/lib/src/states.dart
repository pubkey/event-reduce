import 'types.dart';
import 'util.dart';

typedef StateResolveFunction<D> = bool Function(
    StateResolveFunctionInput<D> input);

/// All states, in the same order as the JavaScript implementation.
/// The BDD references the states by their index in this list.
const List<StateName> orderedStateList = StateName.values;

bool hasLimit<D>(StateResolveFunctionInput<D> input) {
  final limit = input.queryParams.limit;
  return limit != null && limit > 0;
}

bool isFindOne<D>(StateResolveFunctionInput<D> input) =>
    input.queryParams.limit == 1;

bool hasSkip<D>(StateResolveFunctionInput<D> input) {
  final skip = input.queryParams.skip;
  return skip != null && skip > 0;
}

bool isDelete<D>(StateResolveFunctionInput<D> input) =>
    input.changeEvent.operation == WriteOperation.delete;

bool isInsert<D>(StateResolveFunctionInput<D> input) =>
    input.changeEvent.operation == WriteOperation.insert;

bool isUpdate<D>(StateResolveFunctionInput<D> input) =>
    input.changeEvent.operation == WriteOperation.update;

bool wasLimitReached<D>(StateResolveFunctionInput<D> input) {
  final limit = input.queryParams.limit;
  return limit != null && limit > 0 && input.previousResults.length >= limit;
}

bool sortParamsChanged<D>(StateResolveFunctionInput<D> input) {
  final doc = input.changeEvent.doc;
  final prev = input.changeEvent.previous;
  if (doc == null) {
    return false;
  }
  if (prev == null) {
    return true;
  }
  return input.queryParams.sortFieldsChanged(prev, doc);
}

bool wasInResult<D>(StateResolveFunctionInput<D> input) {
  final id = input.changeEvent.id;
  final map = input.keyDocumentMap;
  if (map != null) {
    return map.containsKey(id);
  }
  return indexOfDocumentId(input.queryParams, input.previousResults, id) >= 0;
}

bool wasFirst<D>(StateResolveFunctionInput<D> input) {
  final results = input.previousResults;
  return results.isNotEmpty &&
      input.queryParams.getDocumentId(results.first) == input.changeEvent.id;
}

bool wasLast<D>(StateResolveFunctionInput<D> input) {
  final results = input.previousResults;
  return results.isNotEmpty &&
      input.queryParams.getDocumentId(results.last) == input.changeEvent.id;
}

/// Compares the given document with the given result item.
/// If the changed document is the result item itself,
/// we cannot sort-compare them, because it might end in a non-deterministic
/// sort order. Because both document could be equal.
/// So instead we have to return true.
bool _compareWithResult<D>(
  StateResolveFunctionInput<D> input,
  D? doc,
  bool first,
  bool Function(int comparison) expected,
) {
  final results = input.previousResults;
  if (doc == null || results.isEmpty) {
    return false;
  }
  final resultItem = first ? results.first : results.last;
  if (input.queryParams.getDocumentId(resultItem) == input.changeEvent.id) {
    return true;
  }
  return expected(input.queryParams.sortComparator(doc, resultItem));
}

bool wasSortedBeforeFirst<D>(StateResolveFunctionInput<D> input) =>
    _compareWithResult(input, input.changeEvent.previous, true, (c) => c < 0);

bool wasSortedAfterLast<D>(StateResolveFunctionInput<D> input) =>
    _compareWithResult(input, input.changeEvent.previous, false, (c) => c > 0);

/// Like [_compareWithResult], but if the changed document is the result item itself,
/// it compares with the neighbor of the result item instead,
/// so we know if the changed document still sorts first or last.
/// If there is no neighbor, the changed document is still first or last.
bool _compareNewDocWithResult<D>(
  StateResolveFunctionInput<D> input,
  bool first,
  bool Function(int comparison) expected,
) {
  final doc = input.changeEvent.doc;
  final results = input.previousResults;
  if (doc == null || results.isEmpty) {
    return false;
  }
  var resultItem = first ? results.first : results.last;
  if (input.queryParams.getDocumentId(resultItem) == input.changeEvent.id) {
    if (results.length < 2) {
      return true;
    }
    resultItem = first ? results[1] : results[results.length - 2];
  }
  return expected(input.queryParams.sortComparator(doc, resultItem));
}

bool isSortedBeforeFirst<D>(StateResolveFunctionInput<D> input) =>
    _compareNewDocWithResult(input, true, (c) => c < 0);

bool isSortedAfterLast<D>(StateResolveFunctionInput<D> input) =>
    _compareNewDocWithResult(input, false, (c) => c > 0);

bool wasMatching<D>(StateResolveFunctionInput<D> input) {
  final prev = input.changeEvent.previous;
  return prev != null && input.queryParams.queryMatcher(prev);
}

bool doesMatchNow<D>(StateResolveFunctionInput<D> input) {
  final doc = input.changeEvent.doc;
  return doc != null && input.queryParams.queryMatcher(doc);
}

bool wasResultsEmpty<D>(StateResolveFunctionInput<D> input) =>
    input.previousResults.isEmpty;

/// Resolves the state with the given index in [orderedStateList].
bool resolveStateByIndex<D>(int index, StateResolveFunctionInput<D> input) {
  switch (index) {
    case 0:
      return isInsert(input);
    case 1:
      return isUpdate(input);
    case 2:
      return isDelete(input);
    case 3:
      return hasLimit(input);
    case 4:
      return isFindOne(input);
    case 5:
      return hasSkip(input);
    case 6:
      return wasResultsEmpty(input);
    case 7:
      return wasLimitReached(input);
    case 8:
      return wasFirst(input);
    case 9:
      return wasLast(input);
    case 10:
      return sortParamsChanged(input);
    case 11:
      return wasInResult(input);
    case 12:
      return wasSortedBeforeFirst(input);
    case 13:
      return wasSortedAfterLast(input);
    case 14:
      return isSortedBeforeFirst(input);
    case 15:
      return isSortedAfterLast(input);
    case 16:
      return wasMatching(input);
    case 17:
      return doesMatchNow(input);
  }
  throw EventReduceError('UNK_STATE $index');
}

bool resolveState<D>(StateName state, StateResolveFunctionInput<D> input) =>
    resolveStateByIndex(state.index, input);

/// Returns the binary representation of all states
/// like '010110110111...' where the first '0' means that the first state is false.
String getStateSet<D>(StateResolveFunctionInput<D> input) => orderedStateList
    .map((state) => resolveState(state, input) ? '1' : '0')
    .join();
