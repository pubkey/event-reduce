// Like in SQL, a query with limit 0 returns no documents. A negative limit throws.

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

typedef Doc = Map<String, Object>;

QueryParams<Doc> queryParams(int? limit, [int? skip]) => QueryParams<Doc>(
  getDocumentId: (doc) => doc['id']! as String,
  skip: skip,
  limit: limit,
  queryMatcher: (doc) => true,
  sortComparator: (a, b) => (a['id']! as String).compareTo(b['id']! as String),
  sortFieldsChanged: (previous, doc) => previous['age'] != doc['age'],
);

final Doc a = {'id': 'a', 'age': 1};
final events = <ChangeEvent<Doc>>[
  ChangeEvent.insert(id: 'a', doc: a),
  ChangeEvent.update(id: 'a', doc: {'id': 'a', 'age': 2}, previous: a),
  ChangeEvent.delete(id: 'a', previous: a),
];

ActionName calculate(QueryParams<Doc> params, ChangeEvent<Doc> event) =>
    calculateActionName(
      StateResolveFunctionInput<Doc>(
        queryParams: params,
        changeEvent: event,
        previousResults: <Doc>[],
      ),
    );

Matcher throwsCode(String code) => throwsA(
  isA<EventReduceError>().having((error) => error.code, 'code', code),
);

void main() {
  test('limit 0 is always doNothing', () {
    for (final skip in [null, 0, 3]) {
      for (final event in events) {
        expect(calculate(queryParams(0, skip), event), ActionName.doNothing);
      }
    }
  });

  test('other limits are not changed', () {
    expect(calculate(queryParams(1), events[0]), ActionName.insertFirst);
    expect(calculate(queryParams(null), events[0]), ActionName.insertFirst);
  });

  test('a negative limit throws', () {
    expect(
      () => calculate(queryParams(-1), events[0]),
      throwsCode('NEG_LIMIT'),
    );
    expect(
      () => createResultWindowBuffer(queryParams(-1)),
      throwsCode('NEG_LIMIT'),
    );
    createResultWindowBuffer(queryParams(0));
  });
}
