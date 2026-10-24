import 'dart:io';

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

import 'helper.dart';

void main() {
  test('packed BDD string is the same as in the JavaScript implementation', () {
    final js =
        File('../javascript/src/bdd/bdd.generated.ts').readAsStringSync();
    expect(js, contains("export const packedBddString = '$packedBddString';"),
        reason: 'dart/lib/src/bdd_generated.dart is out of sync');
  });

  test('packed BDD only references known states and actions', () {
    expect(packedBdd.length % 3, 0);
    final n = packedBdd.length ~/ 3;
    for (var i = 0; i < packedBdd.length; i += 3) {
      expect(packedBdd[i], lessThan(orderedStateList.length));
      for (final ref in [packedBdd[i + 1], packedBdd[i + 2]]) {
        expect(ref < n || ref - n < orderedActionList.length, isTrue);
      }
    }
  });

  test('insert into empty results without limit', () {
    final action = calculateActionName(StateResolveFunctionInput(
      queryParams: queryParams(10),
      changeEvent: insert(Human('a', 20)),
      previousResults: <Human>[],
    ));
    expect(action, ActionName.insertFirst);
  });

  test('insert of a non matching document does nothing', () {
    final action = calculateActionName(StateResolveFunctionInput(
      queryParams: queryParams(10),
      changeEvent: insert(Human('a', 5)),
      previousResults: [Human('b', 20)],
    ));
    expect(action, ActionName.doNothing);
  });
}
