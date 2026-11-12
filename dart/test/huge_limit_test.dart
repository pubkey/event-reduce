// A limit as large as the largest integer, like when it is used for "no limit", must not overflow.

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

typedef Row = Map<String, String>;

/// The largest 64 bit integer, calculated so that this file also compiles for the web.
final int hugeLimit = int.parse('9223372036854775807');

ResultWindowBuffer<Row> buffer({
  int? skip,
  required int limitBufferSize,
  required int skipBufferSize,
}) => createResultWindowBuffer(
  QueryParams<Row>(
    getDocumentId: (doc) => doc['id']!,
    skip: skip,
    limit: hugeLimit,
    queryMatcher: (doc) => true,
    sortComparator: (a, b) => a['id']!.compareTo(b['id']!),
    sortFieldsChanged: (previous, doc) => false,
  ),
  limitBufferSize: limitBufferSize,
  skipBufferSize: skipBufferSize,
);

List<String> ids(List<Row> rows) => rows.map((row) => row['id']!).toList();

void main() {
  test('huge limit with a limit buffer', () {
    final b = buffer(limitBufferSize: 1, skipBufferSize: 0);
    // more rows than can be counted means that all rows are needed
    expect(getResultWindowBufferQuery(b), (skip: 0, limit: null));
    resetResultWindowBuffer(b, <Row>[
      {'id': 'a'},
    ]);
    expect(b.complete, true);
    expect(ids(getResultWindowBufferResults(b)), ['a']);
  });

  test('huge limit with a skip buffer', () {
    final b = buffer(skip: 1, limitBufferSize: 0, skipBufferSize: 1);
    expect(getResultWindowBufferQuery(b), (skip: 0, limit: null));
    resetResultWindowBuffer(b, <Row>[
      {'id': 'a'},
      {'id': 'b'},
    ]);
    final result = applyChangeEventToResultWindowBuffer(
      b,
      ChangeEvent.insert(id: 'c', doc: {'id': 'c'}),
    );
    expect(result, ResultWindowBufferResult.eventReduce);
    expect(ids(getResultWindowBufferResults(b)), ['b', 'c']);
  });
}
