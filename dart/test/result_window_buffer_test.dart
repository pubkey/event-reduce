// Basic tests of the result window buffer,
// ported from javascript/test/unit/result-window-buffer.test.ts.

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

const all = resultWindowBufferAllRows;

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

String ids(List<Doc> docs) => docs.map((d) => d.id).join(',');

String results(ResultWindowBuffer<Doc> buffer) =>
    ids(getResultWindowBufferResults(buffer));

ChangeEvent<Doc> insert(Doc doc) => ChangeEvent.insert(id: doc.id, doc: doc);

ChangeEvent<Doc> update(Doc previous, Doc doc) =>
    ChangeEvent.update(id: doc.id, doc: doc, previous: previous);

ChangeEvent<Doc> delete(Doc previous) =>
    ChangeEvent.delete(id: previous.id, previous: previous);

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
      final buffer = bufferOf(TestQuery(true, skip: 2, limit: 0), 2, 2);
      // no rows are kept, so the buffer query asks for none
      expect(getResultWindowBufferQuery(buffer), ResultWindowBufferQuery(2, 0));
      resetResultWindowBuffer(buffer, <Doc>[]);
      for (final event in [
        insert(Doc('a', 1)),
        update(Doc('a', 1), Doc('a', 2)),
        delete(Doc('a', 2)),
      ]) {
        expect(applyChangeEventToResultWindowBuffer(buffer, event),
            ResultWindowBufferResult.eventReduce);
        expect(results(buffer), '');
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
  });
}
