// Applies random change events and checks that the results of EventReduce
// are equal to the results of running the full query over the database again.

import 'dart:math';

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

import 'helper.dart';

List<Human> runFullQuery(QueryParams<Human> params, Map<String, Human> db) {
  final all = db.values.where(params.queryMatcher).toList()
    ..sort(params.sortComparator);
  final start = min(params.skip ?? 0, all.length);
  final limit = params.limit;
  final end = limit == null ? all.length : min(start + limit, all.length);
  return all.sublist(start, end);
}

int fuzz(int seed, int? skip, int? limit, bool useMap) {
  final random = Random(seed);
  final params = queryParams(10, skip: skip, limit: limit);
  final db = <String, Human>{};
  var results = runFullQuery(params, db);
  var map = toMap(results);
  var optimized = 0;
  for (var i = 0; i < 1000; i++) {
    final ChangeEvent<Human> event;
    if (db.isEmpty || random.nextInt(3) == 0) {
      final doc = Human('doc$i', random.nextInt(40));
      db[doc.id] = doc;
      event = insert(doc);
    } else {
      final keys = db.keys.toList();
      final previous = db[keys[random.nextInt(keys.length)]]!;
      if (random.nextInt(3) == 0) {
        db.remove(previous.id);
        event = delete(previous);
      } else {
        final doc = random.nextInt(4) == 0
            ? previous.copyWith(name: 'renamed$i')
            : previous.copyWith(age: random.nextInt(40));
        db[doc.id] = doc;
        event = update(previous, doc);
      }
    }

    final action = calculateActionName(StateResolveFunctionInput(
      queryParams: params,
      changeEvent: event,
      previousResults: results,
      keyDocumentMap: useMap ? map : null,
    ));
    expect(action, isNot(ActionName.unknownAction));
    if (action == ActionName.runFullQueryAgain) {
      results = runFullQuery(params, db);
      map = toMap(results);
    } else {
      optimized++;
      runAction(action, params, event, results, useMap ? map : null);
      expect(results, runFullQuery(params, db),
          reason: 'wrong results after $action on $event (seed $seed)');
      if (useMap) {
        expect(map, toMap(results));
      }
    }
  }
  return optimized;
}

void main() {
  final cases = <(int?, int?, bool)>[
    (null, null, false),
    (null, null, true),
    (null, 1, false),
    (null, 5, false),
    (null, 5, true),
    (3, 5, false),
    (3, 5, true),
  ];
  for (final (skip, limit, useMap) in cases) {
    test(
        'same results as the full query (skip: $skip, limit: $limit, map: $useMap)',
        () {
      for (var seed = 1; seed <= 10; seed++) {
        expect(fuzz(seed * 7919, skip, limit, useMap), greaterThan(0));
      }
    });
  }
}
