import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

import 'helper.dart';

bool resolve(
  StateName state,
  QueryParams<Human> params,
  ChangeEvent<Human> event,
  List<Human> results, [
  Map<String, Human>? map,
]) =>
    resolveState(
      state,
      StateResolveFunctionInput(
        queryParams: params,
        changeEvent: event,
        previousResults: results,
        keyDocumentMap: map,
      ),
    );

void main() {
  test('state names match the JavaScript order', () {
    expect(orderedStateList.map((s) => s.name).toList(), [
      'isInsert', 'isUpdate', 'isDelete', 'hasLimit', 'isFindOne', 'hasSkip',
      'wasResultsEmpty', 'wasLimitReached', 'wasFirst', 'wasLast',
      'sortParamsChanged', 'wasInResult', 'wasSortedBeforeFirst',
      'wasSortedAfterLast', 'isSortedBeforeFirst', 'isSortedAfterLast',
      'wasMatching', 'doesMatchNow', //
    ]);
  });

  test('limit and skip', () {
    final event = insert(Human('a', 20));
    var params = queryParams(0, skip: 2, limit: 1);
    expect(resolve(StateName.hasLimit, params, event, []), isTrue);
    expect(resolve(StateName.isFindOne, params, event, []), isTrue);
    expect(resolve(StateName.hasSkip, params, event, []), isTrue);
    expect(resolve(StateName.wasLimitReached, params, event, [Human('b', 1)]),
        isTrue);
    params = queryParams(0, skip: 0);
    expect(resolve(StateName.hasLimit, params, event, []), isFalse);
    expect(resolve(StateName.isFindOne, params, event, []), isFalse);
    expect(resolve(StateName.hasSkip, params, event, []), isFalse);
    expect(resolve(StateName.wasLimitReached, params, event, [Human('b', 1)]),
        isFalse);
  });

  test('operations', () {
    final params = queryParams(0);
    final event = delete(Human('a', 1));
    expect(resolve(StateName.isDelete, params, event, []), isTrue);
    expect(resolve(StateName.isInsert, params, event, []), isFalse);
    expect(resolve(StateName.isUpdate, params, event, []), isFalse);
  });

  test('sortParamsChanged', () {
    final params = queryParams(0);
    final a = Human('a', 1);
    expect(
        resolve(StateName.sortParamsChanged, params,
            update(a, a.copyWith(name: 'other')), []),
        isFalse);
    expect(
        resolve(StateName.sortParamsChanged, params,
            update(a, a.copyWith(age: 2)), []),
        isTrue);
    expect(resolve(StateName.sortParamsChanged, params, insert(a), []), isTrue);
    expect(
        resolve(StateName.sortParamsChanged, params, delete(a), []), isFalse);
  });

  test('wasInResult with and without map', () {
    final params = queryParams(0);
    final event = update(Human('b', 1), Human('b', 2));
    final results = [Human('a', 1), Human('b', 1)];
    expect(resolve(StateName.wasInResult, params, event, results), isTrue);
    expect(resolve(StateName.wasInResult, params, event, results.sublist(0, 1)),
        isFalse);
    expect(
        resolve(StateName.wasInResult, params, event, results, toMap(results)),
        isTrue);
  });

  test('first and last', () {
    final params = queryParams(0);
    final results = [Human('a', 1), Human('b', 5), Human('c', 10)];
    var event = update(Human('a', 1), Human('a', 20));
    expect(resolve(StateName.wasFirst, params, event, results), isTrue);
    expect(resolve(StateName.wasLast, params, event, results), isFalse);
    // the changed document is the first one, so it must be true
    expect(resolve(StateName.wasSortedBeforeFirst, params, event, results),
        isTrue);
    expect(
        resolve(StateName.wasSortedAfterLast, params, event, results), isFalse);
    expect(
        resolve(StateName.isSortedAfterLast, params, event, results), isTrue);
    event = insert(Human('d', 0));
    expect(
        resolve(StateName.isSortedBeforeFirst, params, event, results), isTrue);
    expect(
        resolve(StateName.isSortedAfterLast, params, event, results), isFalse);
    expect(resolve(StateName.wasSortedBeforeFirst, params, event, results),
        isFalse);
    expect(resolve(StateName.isSortedBeforeFirst, params, event, []), isFalse);
  });

  test('matching', () {
    final params = queryParams(10);
    final event = update(Human('a', 5), Human('a', 20));
    expect(resolve(StateName.wasMatching, params, event, []), isFalse);
    expect(resolve(StateName.doesMatchNow, params, event, []), isTrue);
    expect(resolve(StateName.wasResultsEmpty, params, event, []), isTrue);
  });

  test('state set', () {
    final set = getStateSet(StateResolveFunctionInput(
      queryParams: queryParams(0),
      changeEvent: insert(Human('a', 1)),
      previousResults: <Human>[],
    ));
    expect(set, '100000100010000001');
  });
}
