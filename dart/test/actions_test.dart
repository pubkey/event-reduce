import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

import 'helper.dart';

void main() {
  test('action names match the JavaScript order', () {
    expect(orderedActionList.map((a) => a.name).toList(), [
      'doNothing', 'insertFirst', 'insertLast', 'removeFirstItem',
      'removeLastItem', 'removeFirstInsertLast', 'removeLastInsertFirst',
      'removeFirstInsertFirst', 'removeLastInsertLast', 'removeExisting',
      'replaceExisting', 'alwaysWrong', 'insertAtSortPosition',
      'removeExistingAndInsertAtSortPosition', 'runFullQueryAgain',
      'unknownAction', //
    ]);
  });

  test('all actions do not crash on any input', () {
    final params = queryParams(0, limit: 3);
    final events = [
      insert(Human('x', 3)),
      update(Human('b', 2), Human('b', 7)),
      delete(Human('b', 2)),
    ];
    final throwing = {
      ActionName.alwaysWrong,
      ActionName.runFullQueryAgain,
      ActionName.unknownAction,
    };
    for (final action in orderedActionList) {
      for (final event in events) {
        for (final start in [
          <Human>[],
          [Human('a', 1), Human('b', 2), Human('c', 3)],
        ]) {
          void run(bool useMap) {
            final results = List.of(start);
            runAction(
                action, params, event, results, useMap ? toMap(results) : null);
          }

          for (final useMap in [true, false]) {
            if (throwing.contains(action)) {
              expect(() => run(useMap), throwsA(isA<EventReduceError>()));
            } else {
              try {
                run(useMap);
              } on EventReduceError {
                // inserting actions on a delete event have no document
                expect(event.doc, isNull);
              }
            }
          }
        }
      }
    }
  });

  test('runFullQueryAgain throws', () {
    final results = [Human('a', 1)];
    expect(
        () => runAction(ActionName.runFullQueryAgain, queryParams(0),
            insert(Human('b', 1)), results),
        throwsA(isA<EventReduceError>()
            .having((e) => e.toString(), 'code', 'EventReduce:RUN_FULL')));
    expect(ids(results), ['a']);
  });

  test('removeExisting from the middle keeps the map in sync', () {
    final results = [Human('a', 1), Human('b', 2), Human('c', 3)];
    final map = toMap(results);
    runAction(ActionName.removeExisting, queryParams(0), delete(Human('b', 2)),
        results, map);
    expect(ids(results), ['a', 'c']);
    expect(map.keys.toSet(), {'a', 'c'});
  });

  test('replaceExisting at the same position', () {
    final results = [Human('a', 1), Human('b', 2), Human('c', 3)];
    final map = toMap(results);
    final renamed = Human('b', 2, 'new');
    runAction(ActionName.replaceExisting, queryParams(0),
        update(Human('b', 2), renamed), results, map);
    expect(results[1], renamed);
    expect(map['b'], renamed);
  });

  test('insertAtSortPosition', () {
    final params = queryParams(0);
    final results = <Human>[];
    for (final doc in [
      Human('b', 5),
      Human('d', 9),
      Human('a', 5),
      Human('c', 7)
    ]) {
      runAction(ActionName.insertAtSortPosition, params, insert(doc), results);
    }
    expect(ids(results), ['a', 'b', 'c', 'd']);
    // inserting a document that is already in the results does nothing
    runAction(ActionName.insertAtSortPosition, params, insert(Human('c', 7)),
        results);
    expect(ids(results), ['a', 'b', 'c', 'd']);
  });

  test('removeFirstInsertLast with map', () {
    final results = [Human('a', 1), Human('b', 2)];
    final map = toMap(results);
    runAction(ActionName.removeFirstInsertLast, queryParams(0, limit: 2),
        insert(Human('c', 3)), results, map);
    expect(ids(results), ['b', 'c']);
    expect(map.keys.toSet(), {'b', 'c'});
  });
}
