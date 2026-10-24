// Result window buffer
// ------------
// For a query with a limit or a skip, EventReduce returns runFullQueryAgain
// when a row has to move into the result window that is not in the previous results:
// the row after the last row (a row left a full window) or the last skipped row
// (a row was added in front of the window).
// The result window buffer keeps rows on both sides of the window in memory,
// so these rows can be taken from memory instead.
// See docs/result-window-buffer.md for the explanation and measurements.
//
// Invariant: `buffer` is always an exact, contiguous slice of the full sorted result
// (without skip and limit): exactly `offset` matching rows sort before its first row,
// and it never contains a wrong row or misses a row in between.
// If `complete` is true, there are no rows after its last row.
// Only if the buffer is empty, `offset` can be larger than the real number of rows.

import 'dart:math' as math;

import 'actions.dart';
import 'bdd.dart';
import 'types.dart';

/// Pass it as a buffer size to keep all rows on that side of the result window.
/// It is the largest integer that is exact on all platforms, also on the web.
const int resultWindowBufferAllRows = 0x1FFFFFFFFFFFFF;

/// Buffer sizes from this value on keep all rows.
/// Keeps the arithmetic far away from an overflow.
const int _maxBufferSize = 1 << 40;

class ResultWindowBuffer<D> {
  /// QueryParams of the original query,
  /// with the skip and limit that are shown to the user.
  final QueryParams<D> queryParams;

  /// Amount of rows to keep after the last row of the result window.
  final int limitBufferSize;

  /// Amount of rows to keep before the first row of the result window,
  /// out of the skipped rows.
  final int skipBufferSize;
  List<D> buffer = [];
  final ResultKeyDocumentMap<D> keyDocumentMap = {};

  /// Number of matching rows that sort before the first row of the buffer.
  int offset = 0;

  /// True if there are no rows after the last row of the buffer.
  bool complete = false;

  ResultWindowBuffer._(
      this.queryParams, this.limitBufferSize, this.skipBufferSize);
}

/// The skip and limit to run the query of the buffer with.
/// [limit] is null if all rows after the skip are needed.
class ResultWindowBufferQuery {
  final int skip;
  final int? limit;

  const ResultWindowBufferQuery(this.skip, this.limit);

  @override
  bool operator ==(Object other) =>
      other is ResultWindowBufferQuery &&
      other.skip == skip &&
      other.limit == limit;

  @override
  int get hashCode => Object.hash(skip, limit);

  @override
  String toString() => 'ResultWindowBufferQuery(skip: $skip, limit: $limit)';
}

/// What applyChangeEventToResultWindowBuffer() did:
/// - eventReduce: an EventReduce action calculated the new buffer
/// - buffer: EventReduce could not do it (or would have dropped a row), the slice rule did it
/// - runFullQueryAgain: the caller must run the query with the skip and limit of
///   getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer()
enum ResultWindowBufferResult { eventReduce, buffer, runFullQueryAgain }

/// What applyChangeEventsToResultWindowBuffer() returns.
/// [results] are the rows of the original skip and limit,
/// [changed] is true if they are not the same rows as before the change events.
/// If [runFullQueryAgain] is true, both are empty.
class ResultWindowBufferChangeResult<D> {
  final bool runFullQueryAgain;
  final bool changed;
  final List<D> results;

  const ResultWindowBufferChangeResult._(
      this.runFullQueryAgain, this.changed, this.results);
}

/// Actions that keep the length of the result by dropping its first or last row.
/// The slice rule can keep that row instead.
const Set<ActionName> _actionsThatDropARow = {
  ActionName.removeFirstItem,
  ActionName.removeLastItem,
  ActionName.removeFirstInsertLast,
  ActionName.removeLastInsertFirst,
  ActionName.removeFirstInsertFirst,
  ActionName.removeLastInsertLast,
  ActionName.insertAtSortPositionRemoveLast,
  ActionName.insertAtSortPositionRemoveFirst,
};

/// The recommended buffer size for each side of the result window.
/// About log2(limit) for small limits, grows faster around limit 400 and is at most 30.
/// Returns 0 for a limit of 1 (like a find-one query) and for queries without a limit.
int getRecommendedResultWindowBufferSize(int? limit) {
  if (limit == null || limit == 0) {
    return 0;
  }
  final size = math.log(limit) / math.ln2 +
      19 / (1 + math.pow(400 / limit, 2).toDouble());
  return math.min(30, size.floor());
}

/// Creates an empty result window buffer.
/// Run the query with the skip and limit of getResultWindowBufferQuery()
/// and pass the rows to resetResultWindowBuffer() before using it.
/// [queryParams] has the skip and limit that are shown to the user.
/// Buffer sizes default to 0, [resultWindowBufferAllRows] keeps all rows on that side.
/// Throws on negative sizes.
ResultWindowBuffer<D> createResultWindowBuffer<D>(
  QueryParams<D> queryParams, {
  int limitBufferSize = 0,
  int skipBufferSize = 0,
}) {
  if (limitBufferSize < 0 || skipBufferSize < 0) {
    throw EventReduceError('RWB_SIZE');
  }
  // with limit 0 the result is always empty, so no rows are kept
  final isEmptyQuery = queryParams.limit == 0;
  int size(int size) => isEmptyQuery ? 0 : math.min(size, _maxBufferSize);
  return ResultWindowBuffer._(
    queryParams,
    size(limitBufferSize),
    size(skipBufferSize),
  );
}

int _getSkip(ResultWindowBuffer<dynamic> resultWindowBuffer) =>
    resultWindowBuffer.queryParams.skip ?? 0;

/// The skip and limit to run the query of the buffer with.
/// limit is null if all rows after the skip are needed.
ResultWindowBufferQuery getResultWindowBufferQuery(
    ResultWindowBuffer<dynamic> resultWindowBuffer) {
  final skip = _getSkip(resultWindowBuffer);
  final bufferSkip = math.max(0, skip - resultWindowBuffer.skipBufferSize);
  final limit = resultWindowBuffer.queryParams.limit;
  final bufferLimit =
      limit != null && resultWindowBuffer.limitBufferSize < _maxBufferSize
          ? (skip - bufferSkip) + limit + resultWindowBuffer.limitBufferSize
          : null;
  return ResultWindowBufferQuery(bufferSkip, bufferLimit);
}

/// Set the buffer to the rows of a fresh query
/// that ran with the skip and limit of getResultWindowBufferQuery().
void resetResultWindowBuffer<D>(
    ResultWindowBuffer<D> resultWindowBuffer, List<D> rows) {
  final query = getResultWindowBufferQuery(resultWindowBuffer);
  final getId = resultWindowBuffer.queryParams.getDocumentId;
  resultWindowBuffer.buffer = List.of(rows);
  resultWindowBuffer.keyDocumentMap
    ..clear()
    ..addAll({for (final doc in rows) getId(doc): doc});
  resultWindowBuffer.offset = query.skip;
  // fewer rows than requested means there are no more rows
  final limit = query.limit;
  resultWindowBuffer.complete = limit == null || rows.length < limit;
}

/// The result that is shown to the user.
/// Throws if the result window is not in the buffer, which happens
/// before resetResultWindowBuffer() was called
/// or when applyChangeEventToResultWindowBuffer() returned runFullQueryAgain
/// and the query did not run again.
List<D> getResultWindowBufferResults<D>(
    ResultWindowBuffer<D> resultWindowBuffer) {
  if (!_isResultWindowInBuffer(resultWindowBuffer)) {
    throw EventReduceError('RWB_OUTDATED');
  }
  final buffer = resultWindowBuffer.buffer;
  final start = math.min(
      _getSkip(resultWindowBuffer) - resultWindowBuffer.offset, buffer.length);
  final limit = resultWindowBuffer.queryParams.limit;
  final end =
      limit == null ? buffer.length : math.min(start + limit, buffer.length);
  return buffer.sublist(start, end);
}

/// Updates the buffer with the change event.
/// Mutates the [resultWindowBuffer].
ResultWindowBufferResult applyChangeEventToResultWindowBuffer<D>(
  ResultWindowBuffer<D> resultWindowBuffer,
  ChangeEvent<D> changeEvent,
) {
  final buffer = resultWindowBuffer.buffer;
  final queryParams = resultWindowBuffer.queryParams;
  if (queryParams.limit == 0) {
    // the result of a query with limit 0 is always empty, nothing can change it
    return ResultWindowBufferResult.eventReduce;
  }
  if (!resultWindowBuffer.complete && buffer.isEmpty) {
    return ResultWindowBufferResult.runFullQueryAgain;
  }

  // 1. Let EventReduce handle the buffer as if it was the result of a query
  // with skip = offset and limit = buffer.length. This is exactly true,
  // because the buffer is an exact slice of the full result.
  // If the buffer is complete, we use buffer.length + 1, so EventReduce
  // knows that the limit is not reached and there are no more rows.
  final input = StateResolveFunctionInput<D>(
    queryParams: QueryParams<D>(
      getDocumentId: queryParams.getDocumentId,
      skip: resultWindowBuffer.offset > 0 ? resultWindowBuffer.offset : null,
      limit: resultWindowBuffer.complete ? buffer.length + 1 : buffer.length,
      queryMatcher: queryParams.queryMatcher,
      sortComparator: queryParams.sortComparator,
      sortFieldsChanged: queryParams.sortFieldsChanged,
    ),
    changeEvent: changeEvent,
    previousResults: buffer,
    keyDocumentMap: resultWindowBuffer.keyDocumentMap,
  );
  final action = orderedActionList[resolveInput(input)];
  final ResultWindowBufferResult result;
  if (action == ActionName.runFullQueryAgain ||
      action == ActionName.unknownAction ||
      _actionsThatDropARow.contains(action)) {
    // 2. EventReduce needs a row before or after the buffer, which it does not know,
    // or it would drop a row to keep the length of the result.
    // But the buffer does not have to keep its length, only to stay an exact slice,
    // so the slice rule lets it shrink or grow instead.
    _applySliceRule(resultWindowBuffer, changeEvent);
    result = ResultWindowBufferResult.buffer;
  } else {
    actionFunction<D>(action)(input);
    result = ResultWindowBufferResult.eventReduce;
  }

  // 3. Do not let the buffer grow without bounds on either side.
  _trimBuffer(resultWindowBuffer);

  // 4. Run the query again if the result window does not fit into the buffer anymore.
  if (!_isResultWindowInBuffer(resultWindowBuffer)) {
    return ResultWindowBufferResult.runFullQueryAgain;
  }
  return result;
}

/// Updates the buffer with all change events.
/// Returns the new results, and if they changed,
/// or runFullQueryAgain if the result window does not fit into the buffer anymore.
/// Then run the query of getResultWindowBufferQuery() and pass the rows to resetResultWindowBuffer().
/// Mutates the [resultWindowBuffer].
ResultWindowBufferChangeResult<D> applyChangeEventsToResultWindowBuffer<D>(
  ResultWindowBuffer<D> resultWindowBuffer,
  List<ChangeEvent<D>> changeEvents,
) {
  const runFullQueryAgain =
      ResultWindowBufferChangeResult<Never>._(true, false, []);
  if (!_isResultWindowInBuffer(resultWindowBuffer)) {
    return runFullQueryAgain;
  }
  final previousResults = getResultWindowBufferResults(resultWindowBuffer);
  for (final changeEvent in changeEvents) {
    if (applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent) ==
        ResultWindowBufferResult.runFullQueryAgain) {
      return runFullQueryAgain;
    }
  }
  final results = getResultWindowBufferResults(resultWindowBuffer);
  // Changed rows are always new objects from the change events,
  // so comparing the rows by reference finds every change.
  var changed = results.length != previousResults.length;
  for (var index = 0; !changed && index < results.length; index++) {
    changed = !identical(results[index], previousResults[index]);
  }
  return ResultWindowBufferChangeResult._(false, changed, results);
}

/// True if all rows of the result window are in the buffer.
bool _isResultWindowInBuffer(ResultWindowBuffer<dynamic> resultWindowBuffer) {
  final start = _getSkip(resultWindowBuffer) - resultWindowBuffer.offset;
  if (start < 0) {
    return false;
  }
  if (resultWindowBuffer.complete) {
    return true;
  }
  final limit = resultWindowBuffer.queryParams.limit;
  return limit != null && resultWindowBuffer.buffer.length >= start + limit;
}

/// Removes rows before the window that are more than skipBufferSize
/// and rows after the window that are more than limitBufferSize.
void _trimBuffer<D>(ResultWindowBuffer<D> resultWindowBuffer) {
  final buffer = resultWindowBuffer.buffer;
  final keyDocumentMap = resultWindowBuffer.keyDocumentMap;
  final getId = resultWindowBuffer.queryParams.getDocumentId;

  final rowsBeforeWindow =
      _getSkip(resultWindowBuffer) - resultWindowBuffer.offset;
  final removeFromStart = math.min(
      rowsBeforeWindow - resultWindowBuffer.skipBufferSize, buffer.length);
  if (removeFromStart > 0) {
    for (final doc in buffer.sublist(0, removeFromStart)) {
      keyDocumentMap.remove(getId(doc));
    }
    buffer.removeRange(0, removeFromStart);
    resultWindowBuffer.offset += removeFromStart;
  }

  final limit = resultWindowBuffer.queryParams.limit;
  if (limit != null) {
    final maxLength =
        math.max(0, _getSkip(resultWindowBuffer) - resultWindowBuffer.offset) +
            limit +
            resultWindowBuffer.limitBufferSize;
    if (buffer.length > maxLength) {
      for (final doc in buffer.sublist(maxLength)) {
        keyDocumentMap.remove(getId(doc));
      }
      buffer.removeRange(maxLength, buffer.length);
      resultWindowBuffer.complete = false;
    }
  }
}

/// The slice rule:
/// Exactly `offset` matching rows sort before the first row of the buffer,
/// and all matching rows that sort between the first and the last row are in the buffer.
/// After the change event, this is still true for the old first and last row, so:
/// - the old version of the changed row is removed from the buffer,
/// - the new version is added if it sorts between the old first and last row,
/// - offset changes by one if the changed row moved into or out of the rows before the first row.
/// If offset is 0, there are no rows before the first row, so a row that sorts before it is added.
/// If the buffer is complete, there are no rows after the last row, so a row that sorts after it is added.
///
/// An empty buffer (only valid when complete) knows only the number of rows before it.
/// There, offset is only an upper bound, which stays an upper bound with the same update.
void _applySliceRule<D>(
  ResultWindowBuffer<D> resultWindowBuffer,
  ChangeEvent<D> changeEvent,
) {
  final queryParams = resultWindowBuffer.queryParams;
  final buffer = resultWindowBuffer.buffer;
  final keyDocumentMap = resultWindowBuffer.keyDocumentMap;
  final previous = changeEvent.previous;
  final doc = changeEvent.doc;
  final wasMatching = previous != null && queryParams.queryMatcher(previous);
  final doesMatchNow = doc != null && queryParams.queryMatcher(doc);

  if (buffer.isEmpty) {
    if (resultWindowBuffer.offset == 0) {
      // there are no rows at all
      if (doc != null && doesMatchNow) {
        _insertAtSortPosition(resultWindowBuffer, doc);
      }
    } else {
      resultWindowBuffer.offset +=
          (doesMatchNow ? 1 : 0) - (wasMatching ? 1 : 0);
    }
    return;
  }

  final first = buffer.first;
  final last = buffer.last;
  final hasRowsBefore = resultWindowBuffer.offset > 0;
  bool isBefore(D d) =>
      hasRowsBefore && _compareRows(queryParams, d, first) < 0;
  final wasBefore = previous != null && wasMatching && isBefore(previous);
  final isBeforeNow = doc != null && doesMatchNow && isBefore(doc);

  final id = changeEvent.id;
  if (keyDocumentMap.containsKey(id)) {
    final getId = queryParams.getDocumentId;
    buffer.removeAt(buffer.indexWhere((d) => getId(d) == id));
    keyDocumentMap.remove(id);
  }
  if (doc != null &&
      doesMatchNow &&
      !isBeforeNow &&
      (resultWindowBuffer.complete ||
          _compareRows(queryParams, doc, last) <= 0)) {
    _insertAtSortPosition(resultWindowBuffer, doc);
  }
  resultWindowBuffer.offset += (isBeforeNow ? 1 : 0) - (wasBefore ? 1 : 0);
}

/// Compares two rows with the sort comparator of the query.
/// Returns 0 only for two versions of the same row that sort at the same position.
/// For different rows that the comparator sees as equal,
/// the primary key decides, so that the order is always deterministic.
int _compareRows<D>(QueryParams<D> queryParams, D a, D b) {
  final idA = queryParams.getDocumentId(a);
  final idB = queryParams.getDocumentId(b);
  final result = queryParams.sortComparator(a, b).sign;
  if (idA == idB) {
    // A deterministic comparator breaks ties by the primary key,
    // which gives the same answer for both directions when the sort values are equal.
    if (result == 0 || result == queryParams.sortComparator(b, a).sign) {
      return 0;
    }
    return result;
  }
  if (result != 0) {
    return result;
  }
  return idA.compareTo(idB);
}

void _insertAtSortPosition<D>(ResultWindowBuffer<D> resultWindowBuffer, D doc) {
  final buffer = resultWindowBuffer.buffer;
  final queryParams = resultWindowBuffer.queryParams;
  // binary search for the first row that sorts after doc
  var low = 0;
  var high = buffer.length;
  while (low < high) {
    final mid = (low + high) >> 1;
    if (_compareRows(queryParams, buffer[mid], doc) < 0) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  buffer.insert(low, doc);
  resultWindowBuffer.keyDocumentMap[queryParams.getDocumentId(doc)] = doc;
}
