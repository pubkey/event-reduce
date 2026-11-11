// An untyped list literal like [] makes Dart infer the type argument dynamic
// for the functions of this library. They must work with it,
// because empty results are the normal start of a query.

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

class Doc {
  final String id;
  final int age;
  Doc(this.id, this.age);
}

final queryParams = QueryParams<Doc>(
  getDocumentId: (doc) => doc.id,
  limit: 2,
  queryMatcher: (doc) => doc.age > 0,
  sortComparator:
      (a, b) => a.age != b.age ? a.age - b.age : a.id.compareTo(b.id),
  sortFieldsChanged: (previous, doc) => previous.age != doc.age,
);

List<String> ids(List<dynamic> docs) =>
    docs.map((doc) => (doc as Doc).id).toList();

void main() {
  final insertC = ChangeEvent.insert(id: 'c', doc: Doc('c', 3));

  test('calculateActionName() with [] as previous results', () {
    final action = calculateActionName(
      StateResolveFunctionInput(
        queryParams: queryParams,
        changeEvent: insertC,
        previousResults: [],
      ),
    );
    expect(action, ActionName.insertFirst);
  });

  test('getStateSet() with [] as previous results', () {
    final stateSet = getStateSet(
      StateResolveFunctionInput(
        queryParams: queryParams,
        changeEvent: ChangeEvent.update(
          id: 'c',
          doc: Doc('c', 4),
          previous: Doc('c', 3),
        ),
        previousResults: [],
      ),
    );
    expect(stateSet.length, orderedStateList.length);
  });

  test('runAction() with [] as previous results and {} as map', () {
    final map = {};
    final results = runAction(
      ActionName.insertAtSortPosition,
      queryParams,
      insertC,
      [],
      map.cast<String, Doc>(),
    );
    expect(ids(results), ['c']);
    runAction(
      ActionName.insertAtSortPosition,
      queryParams,
      ChangeEvent.insert(id: 'a', doc: Doc('a', 1)),
      results,
    );
    expect(ids(results), ['a', 'c']);
    runAction(
      ActionName.removeFirstItem,
      queryParams,
      ChangeEvent.delete(id: 'a', previous: Doc('a', 1)),
      results,
    );
    expect(ids(results), ['c']);
  });

  test('result window buffer that is reset with []', () {
    final buffer = createResultWindowBuffer(
      queryParams,
      limitBufferSize: 1,
      skipBufferSize: 1,
    );
    resetResultWindowBuffer(buffer, []);
    expect(getResultWindowBufferResults(buffer), isEmpty);

    expect(
      applyChangeEventToResultWindowBuffer(buffer, insertC),
      ResultWindowBufferResult.eventReduce,
    );
    final change = applyChangeEventsToResultWindowBuffer(buffer, [
      ChangeEvent.insert(id: 'a', doc: Doc('a', 1)),
      ChangeEvent.insert(id: 'b', doc: Doc('b', 2)),
      ChangeEvent.update(id: 'c', doc: Doc('c', 0), previous: Doc('c', 3)),
    ]);
    expect(change.runFullQueryAgain, false);
    expect(ids(change.results), ['a', 'b']);
    // the buffer still has rows of its own type
    final List<Doc> results = getResultWindowBufferResults(buffer);
    expect(ids(results), ['a', 'b']);

    expect(applyChangeEventsToResultWindowBuffer(buffer, []).changed, false);
  });
}
