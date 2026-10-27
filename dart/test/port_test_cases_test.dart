// Runs the test cases that the JavaScript implementation created,
// see javascript/test/helper/port-test-cases.ts.
// This implementation only resolves the BDD that was created there,
// so it must calculate the same state set and action for every case.

import 'dart:convert';
import 'dart:io';

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

typedef Doc = Map<String, dynamic>;

/// The query of the test cases: age > minAge, sorted by age, then by id.
QueryParams<Doc> queryParams(Map<String, dynamic> query) => QueryParams<Doc>(
      getDocumentId: (doc) => doc['id'] as String,
      skip: query['skip'] as int?,
      limit: query['limit'] as int?,
      queryMatcher: (doc) => (doc['age'] as int) > (query['minAge'] as int),
      sortComparator: (a, b) {
        final byAge = (a['age'] as int).compareTo(b['age'] as int);
        return byAge != 0
            ? byAge
            : (a['id'] as String).compareTo(b['id'] as String);
      },
      sortFieldsChanged: (prev, doc) => prev['age'] != doc['age'],
    );

ChangeEvent<Doc> changeEvent(Map<String, dynamic> event) {
  final id = event['id'] as String;
  switch (event['operation']) {
    case 'INSERT':
      return ChangeEvent.insert(id: id, doc: event['doc'] as Doc);
    case 'UPDATE':
      return ChangeEvent.update(
          id: id, doc: event['doc'] as Doc, previous: event['previous'] as Doc);
    default:
      return ChangeEvent.delete(id: id, previous: event['previous'] as Doc);
  }
}

void main() {
  test('same state set and action as the JavaScript implementation', () {
    final cases = jsonDecode(
        File('../javascript/test/fixtures/port-test-cases.json')
            .readAsStringSync()) as List<dynamic>;
    expect(cases.length, greaterThan(100));
    for (var index = 0; index < cases.length; index++) {
      final testCase = cases[index] as Map<String, dynamic>;
      final input = StateResolveFunctionInput<Doc>(
        queryParams: queryParams(testCase['query'] as Map<String, dynamic>),
        changeEvent:
            changeEvent(testCase['changeEvent'] as Map<String, dynamic>),
        previousResults:
            (testCase['previousResults'] as List<dynamic>).cast<Doc>().toList(),
      );
      expect(getStateSet(input), testCase['stateSet'],
          reason: 'state set of case #$index');
      expect(calculateActionName(input).name, testCase['action'],
          reason: 'action of case #$index');
    }
  });
}
