// Port of javascript/test/unit/result-window-buffer.test.ts
// After every event, the visible result must equal the full query,
// and the buffer must be an exact slice of the full result.

import 'dart:math';

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

class Doc {
  final String id;
  final bool female;
  final int age;
  const Doc(this.id, this.age, {this.female = true});

  @override
  String toString() => 'Doc($id, $age, $female)';
}

class TestQuery {
  final bool asc;
  final int? skip;
  final int? limit;
  const TestQuery(this.asc, {this.skip, this.limit});

  @override
  String toString() => 'sort ${asc ? 'asc' : 'desc'}, skip $skip, limit $limit';
}

const queries = [
  TestQuery(true, limit: 20),
  TestQuery(false, limit: 20),
  TestQuery(true, skip: 10, limit: 20),
  TestQuery(false, skip: 10, limit: 20),
  TestQuery(true, limit: 1),
  TestQuery(false, skip: 3, limit: 5),
  // skip without limit
  TestQuery(true, skip: 5),
  // neither skip nor limit
  TestQuery(true),
];
const all = resultWindowBufferAllRows;
const bufferSizes = [(0, 0), (5, 0), (0, 5), (20, 3), (50, 20), (all, all)];
const initialRowsList = [0, 30, 300];
const eventsPerRun = 600;

/// The query is always: female, sorted by age, then by id.
/// Age has only 100 different values, so many rows have the same age
/// and the id decides their order.
QueryParams<Doc> queryParams(TestQuery query) {
  final direction = query.asc ? 1 : -1;
  return QueryParams<Doc>(
    getDocumentId: (d) => d.id,
    skip: query.skip,
    limit: query.limit,
    queryMatcher: (d) => d.female,
    sortComparator: (a, b) {
      final byAge = a.age.compareTo(b.age);
      return direction * (byAge != 0 ? byAge : a.id.compareTo(b.id));
    },
    sortFieldsChanged: (prev, doc) => prev.age != doc.age,
  );
}

ResultWindowBuffer<Doc> bufferOf(TestQuery query,
        [int limitBufferSize = 0, int skipBufferSize = 0]) =>
    createResultWindowBuffer(queryParams(query),
        limitBufferSize: limitBufferSize, skipBufferSize: skipBufferSize);

/// Full query over all documents: filter, sort, skip, limit.
List<Doc> runQuery(
    Map<String, Doc> docs, QueryParams<Doc> params, int skip, int? limit) {
  final all = docs.values.where(params.queryMatcher).toList()
    ..sort(params.sortComparator);
  final start = min(skip, all.length);
  final end = limit == null ? all.length : min(start + limit, all.length);
  return all.sublist(start, end);
}

void fill(ResultWindowBuffer<Doc> buffer, Map<String, Doc> docs) {
  final query = getResultWindowBufferQuery(buffer);
  resetResultWindowBuffer(
      buffer, runQuery(docs, buffer.queryParams, query.skip, query.limit));
}

String ids(List<Doc> docs) => docs.map((d) => d.id).join(',');

String results(ResultWindowBuffer<Doc> buffer) =>
    ids(getResultWindowBufferResults(buffer));

ChangeEvent<Doc> insert(Doc doc) => ChangeEvent.insert(id: doc.id, doc: doc);

ChangeEvent<Doc> update(Doc previous, Doc doc) =>
    ChangeEvent.update(id: doc.id, doc: doc, previous: previous);

ChangeEvent<Doc> delete(Doc previous) =>
    ChangeEvent.delete(id: previous.id, previous: previous);

typedef Weights = ({double insert, double update, double delete});
const Weights onlyInserts = (insert: 1, update: 0, delete: 0);

/// First more inserts, then mostly updates, then more deletes,
/// so that the result grows, moves around and shrinks to (almost) nothing.
Weights weights(int eventIndex) {
  final phase = eventIndex / eventsPerRun;
  if (phase < 0.4) {
    return (insert: 3, update: 5, delete: 1);
  } else if (phase < 0.7) {
    return (insert: 1, update: 8, delete: 1);
  }
  return (insert: 1, update: 3, delete: 5);
}

ChangeEvent<Doc> randomChangeEvent(Map<String, Doc> docs, Random random,
    String Function() newId, Weights weights) {
  int randomInt(int min, int max) => min + random.nextInt(max - min + 1);
  final total = weights.insert + weights.update + weights.delete;
  var r = random.nextDouble() * total;
  if (docs.isEmpty || r < weights.insert) {
    return insert(
        Doc(newId(), randomInt(1, 100), female: random.nextDouble() < 0.5));
  }
  r -= weights.insert;
  final allDocs = docs.values.toList();
  final previous = allDocs[randomInt(0, allDocs.length - 1)];
  if (r < weights.update) {
    final doc = random.nextDouble() < 0.5
        // starts or stops matching
        ? Doc(previous.id, previous.age, female: !previous.female)
        // moves in the sort order
        : Doc(previous.id, randomInt(1, 100), female: previous.female);
    return update(previous, doc);
  }
  return delete(previous);
}

void applyToDocs(Map<String, Doc> docs, ChangeEvent<Doc> changeEvent) {
  final doc = changeEvent.doc;
  if (doc == null) {
    docs.remove(changeEvent.id);
  } else {
    docs[doc.id] = doc;
  }
}

String Function() counterIds() {
  var counter = 0;
  return () => 'id-${(counter++).toString().padLeft(5, '0')}';
}

void main() {
  test('getRecommendedResultWindowBufferSize() for each limit', () {
    const expected = [
      (null, 0), (0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (10, 3), (20, 4),
      (100, 7), (200, 11), (500, 20), (1000, 26), (2711, 29), (2712, 30),
      (100000, 30), //
    ];
    for (final (limit, size) in expected) {
      expect(getRecommendedResultWindowBufferSize(limit), size,
          reason: 'limit $limit');
    }
  });

  group('getResultWindowBufferQuery()', () {
    test('adds the buffer sizes to the skip and limit', () {
      expect(
          getResultWindowBufferQuery(
              bufferOf(TestQuery(true, skip: 10, limit: 20), 5, 3)),
          ResultWindowBufferQuery(7, 28));
      // not below skip 0
      expect(
          getResultWindowBufferQuery(
              bufferOf(TestQuery(true, skip: 2, limit: 20), 0, 5)),
          ResultWindowBufferQuery(0, 22));
      // not set means 0
      expect(
          getResultWindowBufferQuery(
              bufferOf(TestQuery(true, skip: 10, limit: 20))),
          ResultWindowBufferQuery(10, 20));
      // all rows
      expect(
          getResultWindowBufferQuery(
              bufferOf(TestQuery(true, skip: 10, limit: 20), all, all)),
          ResultWindowBufferQuery(0, null));
      // no limit for a query without a limit
      expect(
          getResultWindowBufferQuery(bufferOf(TestQuery(true, skip: 10), 5, 3)),
          ResultWindowBufferQuery(7, null));
    });
    test('throws on negative buffer sizes', () {
      final params = queryParams(TestQuery(true, skip: 10, limit: 20));
      expect(() => createResultWindowBuffer(params, limitBufferSize: -1),
          throwsA(isA<EventReduceError>()));
      expect(() => createResultWindowBuffer(params, skipBufferSize: -1),
          throwsA(isA<EventReduceError>()));
    });
  });

  group('resetResultWindowBuffer()', () {
    test('asks for a full query and has no results before it got rows', () {
      final buffer = bufferOf(TestQuery(true, limit: 2));
      expect(() => getResultWindowBufferResults(buffer),
          throwsA(isA<EventReduceError>()));
      expect(applyChangeEventToResultWindowBuffer(buffer, insert(Doc('a', 1))),
          ResultWindowBufferResult.runFullQueryAgain);
    });
    test('is complete when the query returned fewer rows than requested', () {
      final buffer = bufferOf(TestQuery(true, limit: 2), 2);
      resetResultWindowBuffer(buffer, [Doc('a', 1), Doc('b', 2), Doc('c', 3)]);
      expect(buffer.complete, isTrue);
      expect(results(buffer), 'a,b');
    });
    test('is not complete when the query returned as many rows as requested',
        () {
      final buffer = bufferOf(TestQuery(true, limit: 1), 1);
      resetResultWindowBuffer(buffer, [Doc('a', 1), Doc('b', 2)]);
      expect(buffer.complete, isFalse);
    });
    test('shows the rows after the skipped rows of the buffer', () {
      final buffer = bufferOf(TestQuery(true, skip: 1, limit: 2), 0, 1);
      resetResultWindowBuffer(buffer, [Doc('a', 1), Doc('b', 2), Doc('c', 3)]);
      expect(buffer.offset, 0);
      expect(results(buffer), 'b,c');
    });
  });

  group('applyChangeEventToResultWindowBuffer()', () {
    test('refills the window from the buffer when a visible row is deleted',
        () {
      final buffer = bufferOf(TestQuery(true, limit: 2), 2);
      resetResultWindowBuffer(
          buffer, [Doc('a', 1), Doc('b', 2), Doc('c', 3), Doc('d', 4)]);
      expect(applyChangeEventToResultWindowBuffer(buffer, delete(Doc('a', 1))),
          ResultWindowBufferResult.buffer);
      expect(results(buffer), 'b,c');
      expect(ids(buffer.buffer), 'b,c,d');
    });
    test('does not append a row that moves behind the last row of the buffer',
        () {
      final buffer = bufferOf(TestQuery(true, limit: 2), 1);
      resetResultWindowBuffer(buffer, [Doc('a', 1), Doc('b', 2), Doc('c', 3)]);
      expect(
          applyChangeEventToResultWindowBuffer(
              buffer, update(Doc('a', 1), Doc('a', 99))),
          ResultWindowBufferResult.buffer);
      expect(ids(buffer.buffer), 'b,c');
    });
    test(
        'asks for a full query when a row is added in front of the skip window without a skip buffer',
        () {
      final buffer = bufferOf(TestQuery(true, skip: 1, limit: 1), 1);
      resetResultWindowBuffer(buffer, [Doc('b', 2), Doc('c', 3)]);
      expect(applyChangeEventToResultWindowBuffer(buffer, insert(Doc('x', 0))),
          ResultWindowBufferResult.runFullQueryAgain);
      // the results are outdated until the query runs again
      expect(() => getResultWindowBufferResults(buffer),
          throwsA(isA<EventReduceError>()));
    });
    test(
        'takes the row from the skip buffer when a row is added in front of the window',
        () {
      final buffer = bufferOf(TestQuery(true, skip: 2, limit: 1), 0, 1);
      // skip 1, limit 2: 'a' is skipped and not in the buffer
      resetResultWindowBuffer(buffer, [Doc('b', 2), Doc('c', 3)]);
      expect(results(buffer), 'c');
      expect(applyChangeEventToResultWindowBuffer(buffer, insert(Doc('x', 0))),
          ResultWindowBufferResult.buffer);
      expect(buffer.offset, 2);
      expect(results(buffer), 'b');
    });
    test('returns no rows for a query with limit 0', () {
      final random = Random(77);
      final newId = counterIds();
      for (final skip in [null, 2]) {
        final docs = <String, Doc>{};
        for (var i = 0; i < 10; i++) {
          applyToDocs(
              docs, randomChangeEvent(docs, random, newId, onlyInserts));
        }
        final buffer = bufferOf(TestQuery(true, skip: skip, limit: 0), 2, 2);
        fill(buffer, docs);
        // no rows are kept, so the buffer query asks for none
        expect(getResultWindowBufferQuery(buffer),
            ResultWindowBufferQuery(skip ?? 0, 0));
        expect(results(buffer), '');
        for (var i = 0; i < 100; i++) {
          final event = randomChangeEvent(docs, random, newId, weights(i));
          applyToDocs(docs, event);
          expect(applyChangeEventToResultWindowBuffer(buffer, event),
              ResultWindowBufferResult.eventReduce);
          expect(results(buffer), '');
          expect(buffer.buffer, isEmpty);
        }
      }
    });
    test('handles a query with a skip but without a limit', () {
      final buffer = bufferOf(TestQuery(true, skip: 1), 0, 1);
      resetResultWindowBuffer(buffer, [Doc('a', 1), Doc('b', 2), Doc('c', 3)]);
      expect(results(buffer), 'b,c');
      expect(applyChangeEventToResultWindowBuffer(buffer, insert(Doc('x', 0))),
          isNot(ResultWindowBufferResult.runFullQueryAgain));
      expect(results(buffer), 'a,b,c');
    });
  });

  group('applyChangeEventsToResultWindowBuffer()', () {
    test('returns the new results and if they changed', () {
      final buffer = bufferOf(TestQuery(true, limit: 2), 3);
      resetResultWindowBuffer(buffer,
          [Doc('a', 1), Doc('b', 2), Doc('c', 3), Doc('d', 4), Doc('e', 5)]);
      // a row after the result window changes
      final notVisible = applyChangeEventsToResultWindowBuffer(
          buffer, [update(Doc('e', 5), Doc('e', 6))]);
      expect(notVisible.runFullQueryAgain, isFalse);
      expect(notVisible.changed, isFalse);

      final visible = applyChangeEventsToResultWindowBuffer(
          buffer, [delete(Doc('a', 1)), delete(Doc('b', 2))]);
      expect(visible.runFullQueryAgain, isFalse);
      expect(visible.changed, isTrue);
      expect(ids(visible.results), 'c,d');
    });
    test('reports a changed row at the same position as changed', () {
      final buffer = bufferOf(TestQuery(true, limit: 2));
      resetResultWindowBuffer(buffer, [Doc('a', 1), Doc('b', 3)]);
      final result = applyChangeEventsToResultWindowBuffer(
          buffer, [update(Doc('a', 1), Doc('a', 2))]);
      expect(result.runFullQueryAgain, isFalse);
      expect(result.changed, isTrue);
    });
    test(
        'asks for a full query when the result window does not fit into the buffer',
        () {
      final buffer = bufferOf(TestQuery(true, limit: 2));
      expect(
          applyChangeEventsToResultWindowBuffer(buffer, []).runFullQueryAgain,
          isTrue);
      resetResultWindowBuffer(buffer, [Doc('a', 1), Doc('b', 2)]);
      expect(
          applyChangeEventsToResultWindowBuffer(buffer, [delete(Doc('a', 1))])
              .runFullQueryAgain,
          isTrue);
    });
    test('returns the same as a full query for random batches of events', () {
      final random = Random(4242);
      final newId = counterIds();
      for (final query in queries) {
        final docs = <String, Doc>{};
        for (var i = 0; i < 30; i++) {
          applyToDocs(
              docs, randomChangeEvent(docs, random, newId, onlyInserts));
        }
        final params = queryParams(query);
        final skip = query.skip ?? 0;
        final buffer = bufferOf(query, 3, 3);
        fill(buffer, docs);
        var previousResults = runQuery(docs, params, skip, query.limit);
        for (var batch = 0; batch < 100; batch++) {
          final events = <ChangeEvent<Doc>>[];
          final batchSize = 1 + random.nextInt(5);
          for (var i = 0; i < batchSize; i++) {
            final event =
                randomChangeEvent(docs, random, newId, weights(batch * 5 + i));
            applyToDocs(docs, event);
            events.add(event);
          }
          final result = applyChangeEventsToResultWindowBuffer(buffer, events);
          final expected = runQuery(docs, params, skip, query.limit);
          if (result.runFullQueryAgain) {
            fill(buffer, docs);
          } else {
            expect(ids(result.results), ids(expected));
            var expectedChanged = expected.length != previousResults.length;
            for (var i = 0; !expectedChanged && i < expected.length; i++) {
              expectedChanged = !identical(expected[i], previousResults[i]);
            }
            expect(result.changed, expectedChanged);
          }
          previousResults = expected;
        }
      }
    });
  });

  test(
      'a buffer with both sizes 0 never runs the full query when EventReduce alone does not',
      () {
    var eventReduceFullQueries = 0;
    var bufferFullQueries = 0;
    var seed = 1000;
    for (final query in queries) {
      for (final initialRows in initialRowsList) {
        seed++;
        final random = Random(seed);
        final newId = counterIds();
        final docs = <String, Doc>{};
        for (var i = 0; i < initialRows; i++) {
          applyToDocs(
              docs, randomChangeEvent(docs, random, newId, onlyInserts));
        }
        final params = queryParams(query);
        final skip = query.skip ?? 0;
        var previousResults = runQuery(docs, params, skip, query.limit);
        var keyDocumentMap = {for (final d in previousResults) d.id: d};
        final buffer = bufferOf(query);
        fill(buffer, docs);

        for (var i = 0; i < eventsPerRun; i++) {
          final event = randomChangeEvent(docs, random, newId, weights(i));
          applyToDocs(docs, event);

          final action = calculateActionName(StateResolveFunctionInput(
            queryParams: params,
            changeEvent: event,
            previousResults: previousResults,
            keyDocumentMap: keyDocumentMap,
          ));
          final eventReduceNeedsQuery = action == ActionName.runFullQueryAgain;
          if (eventReduceNeedsQuery) {
            eventReduceFullQueries++;
            previousResults = runQuery(docs, params, skip, query.limit);
            keyDocumentMap = {for (final d in previousResults) d.id: d};
          } else {
            runAction(action, params, event, previousResults, keyDocumentMap);
          }

          final bufferNeedsQuery =
              applyChangeEventToResultWindowBuffer(buffer, event) ==
                  ResultWindowBufferResult.runFullQueryAgain;
          if (bufferNeedsQuery) {
            bufferFullQueries++;
            fill(buffer, docs);
          }
          expect(!bufferNeedsQuery || eventReduceNeedsQuery, isTrue,
              reason:
                  'buffer needs a full query but EventReduce does not at event #$i');
          expect(
              results(buffer), ids(runQuery(docs, params, skip, query.limit)));
        }
      }
    }
    expect(bufferFullQueries, lessThanOrEqualTo(eventReduceFullQueries));
  });

  group('randomized against a full query', () {
    final counts = <ResultWindowBufferResult, int>{};
    var seed = 0;
    for (final query in queries) {
      for (final (limitBufferSize, skipBufferSize) in bufferSizes) {
        for (final initialRows in initialRowsList) {
          seed++;
          final runSeed = seed;
          test(
              '$query, limitBufferSize $limitBufferSize, skipBufferSize $skipBufferSize, $initialRows initial rows',
              () {
            final random = Random(runSeed);
            var counter = 0;
            String newId() =>
                '${random.nextInt(1000000000).toString().padLeft(9, '0')}-${++counter}';
            final docs = <String, Doc>{};
            for (var i = 0; i < initialRows; i++) {
              applyToDocs(
                  docs, randomChangeEvent(docs, random, newId, onlyInserts));
            }
            final params = queryParams(query);
            final skip = query.skip ?? 0;
            final buffer = bufferOf(query, limitBufferSize, skipBufferSize);
            fill(buffer, docs);

            for (var i = 0; i < eventsPerRun; i++) {
              final event = randomChangeEvent(docs, random, newId, weights(i));
              applyToDocs(docs, event);

              final result =
                  applyChangeEventToResultWindowBuffer(buffer, event);
              counts[result] = (counts[result] ?? 0) + 1;
              if (result == ResultWindowBufferResult.runFullQueryAgain) {
                fill(buffer, docs);
              }
              final context =
                  'event #$i (${event.operation.name}, ${result.name})';

              // the visible result equals the full query
              expect(results(buffer),
                  ids(runQuery(docs, params, skip, query.limit)),
                  reason: 'visible result differs from full query at $context');

              // the buffer is an exact slice of the full result
              final full = runQuery(docs, params, 0, null);
              if (buffer.buffer.isNotEmpty) {
                final start = min(buffer.offset, full.length);
                final end =
                    min(buffer.offset + buffer.buffer.length, full.length);
                expect(ids(buffer.buffer), ids(full.sublist(start, end)),
                    reason:
                        'buffer is not an exact slice of the full result at $context');
              } else {
                // an empty buffer only knows an upper bound of the rows before it
                expect(buffer.complete, isTrue,
                    reason: 'empty buffer must be complete at $context');
                expect(full.length, lessThanOrEqualTo(buffer.offset),
                    reason: 'offset is no upper bound at $context');
              }
              if (buffer.complete) {
                expect(buffer.offset + buffer.buffer.length,
                    greaterThanOrEqualTo(full.length),
                    reason: 'complete buffer misses rows at $context');
              }

              // the buffer keeps no more rows than requested on both sides
              final rowsBefore = skip - buffer.offset;
              expect(rowsBefore, lessThanOrEqualTo(skipBufferSize),
                  reason: 'too many rows before the window');
              final limit = query.limit;
              if (limit != null && limitBufferSize != all) {
                expect(
                    buffer.buffer.length,
                    lessThanOrEqualTo(
                        max(0, rowsBefore) + limit + limitBufferSize),
                    reason: 'too many rows after the window');
              }

              // the key map matches the buffer
              expect(buffer.keyDocumentMap.length, buffer.buffer.length);
              for (final d in buffer.buffer) {
                expect(identical(buffer.keyDocumentMap[d.id], d), isTrue);
              }
            }
          });
        }
      }
    }

    test('has used all three paths', () {
      for (final result in ResultWindowBufferResult.values) {
        expect(counts[result] ?? 0, greaterThan(0), reason: '$counts');
      }
    });
  });
}
