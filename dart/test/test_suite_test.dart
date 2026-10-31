// Runs the test suite that all implementations share, see ../test-suite/README.md.

import 'dart:convert';
import 'dart:io';

import 'package:event_reduce/event_reduce.dart';
import 'package:test/test.dart';

typedef Doc = Map<String, dynamic>;

dynamic load(String file) =>
    jsonDecode(File('../test-suite/$file').readAsStringSync());

Doc copy(dynamic doc) => Map<String, dynamic>.of(doc as Map<String, dynamic>);

List<Doc> copyAll(dynamic docs) => (docs as List<dynamic>).map(copy).toList();

List<String> ids(List<Doc> docs) => docs.map((d) => d['id'] as String).toList();

QueryParams<Doc> queryParams(Map<String, dynamic> query) {
  final direction = query['desc'] == true ? -1 : 1;
  return QueryParams<Doc>(
    getDocumentId: (doc) => doc['id'] as String,
    skip: query['skip'] as int?,
    limit: query['limit'] as int?,
    queryMatcher: (doc) => (doc['age'] as int) > (query['minAge'] as int),
    sortComparator: (a, b) {
      final byAge = (a['age'] as int).compareTo(b['age'] as int);
      final byId = (a['id'] as String).compareTo(b['id'] as String);
      return direction * (byAge != 0 ? byAge : byId);
    },
    sortFieldsChanged: (previous, doc) => previous['age'] != doc['age'],
  );
}

ChangeEvent<Doc> changeEvent(Map<String, dynamic> event) {
  final id = event['id'] as String;
  switch (event['operation']) {
    case 'INSERT':
      return ChangeEvent.insert(id: id, doc: copy(event['doc']));
    case 'UPDATE':
      return ChangeEvent.update(
        id: id,
        doc: copy(event['doc']),
        previous: copy(event['previous']),
      );
    default:
      return ChangeEvent.delete(id: id, previous: copy(event['previous']));
  }
}

String errorCode(EventReduceError error) =>
    error.toString().replaceFirst('EventReduce:', '');

int bufferSize(dynamic size) =>
    size == 'all' ? resultWindowBufferAllRows : size as int;

void main() {
  final stateSets = load('state-sets.json') as Map<String, dynamic>;
  final cases = load('cases.json') as Map<String, dynamic>;

  test('state sets', () {
    expect(
      stateSets['packedBdd'],
      packedBdd,
      reason: 'bdd_generated.dart is out of sync with the JavaScript BDD',
    );
    final stateSetCases = stateSets['cases'] as List<dynamic>;
    for (var index = 0; index < stateSetCases.length; index++) {
      final testCase = stateSetCases[index] as Map<String, dynamic>;
      final input = StateResolveFunctionInput<Doc>(
        queryParams: queryParams(testCase['query'] as Map<String, dynamic>),
        changeEvent: changeEvent(
          testCase['changeEvent'] as Map<String, dynamic>,
        ),
        previousResults: copyAll(testCase['previousResults']),
      );
      expect(
        getStateSet(input),
        testCase['stateSet'],
        reason: 'state set of case #$index',
      );
      expect(
        calculateActionName(input).name,
        testCase['action'],
        reason: 'action of case #$index',
      );
    }
  });

  group('actions', () {
    for (final testCase in cases['actions'] as List<dynamic>) {
      testCase as Map<String, dynamic>;
      test(testCase['name'] as String, () {
        final params = queryParams(testCase['query'] as Map<String, dynamic>);
        final event = changeEvent(
          testCase['changeEvent'] as Map<String, dynamic>,
        );
        final results = copyAll(testCase['previousResults']);
        final keyDocumentMap =
            testCase['useKeyDocumentMap'] == true
                ? {for (final doc in results) doc['id'] as String: doc}
                : null;
        ActionName action;
        if (testCase['action'] != null) {
          action = ActionName.values.byName(testCase['action'] as String);
        } else {
          action = calculateActionName(
            StateResolveFunctionInput(
              queryParams: params,
              changeEvent: event,
              previousResults: results,
              keyDocumentMap: keyDocumentMap,
            ),
          );
          expect(action.name, testCase['expectedAction']);
        }
        String? error;
        try {
          runAction(action, params, event, results, keyDocumentMap);
        } on EventReduceError catch (err) {
          error = errorCode(err);
        }
        expect(error, testCase['expectedError']);
        expect(results, testCase['expectedResults']);
        if (keyDocumentMap != null) {
          final mapDocs =
              keyDocumentMap.values.toList()..sort(
                (a, b) => (a['id'] as String).compareTo(b['id'] as String),
              );
          expect(mapDocs, testCase['expectedKeyDocumentMap']);
        }
      });
    }
  });

  group('result window buffer', () {
    for (final scenario in cases['resultWindowBuffer'] as List<dynamic>) {
      scenario as Map<String, dynamic>;
      test(scenario['name'] as String, () {
        final buffer = createResultWindowBuffer(
          queryParams(scenario['query'] as Map<String, dynamic>),
          limitBufferSize: bufferSize(scenario['limitBufferSize']),
          skipBufferSize: bufferSize(scenario['skipBufferSize']),
        );
        final steps = scenario['steps'] as List<dynamic>;
        for (var index = 0; index < steps.length; index++) {
          final step = steps[index] as Map<String, dynamic>;
          final context = 'step #$index ${step['op']}';
          switch (step['op']) {
            case 'query':
              final query = getResultWindowBufferQuery(buffer);
              expect(
                {'skip': query.skip, 'limit': query.limit},
                step['expected'],
                reason: context,
              );
            case 'reset':
              resetResultWindowBuffer(buffer, copyAll(step['rows']));
            case 'results':
              List<String>? results;
              String? error;
              try {
                results = ids(getResultWindowBufferResults(buffer));
              } on EventReduceError catch (err) {
                error = errorCode(err);
              }
              expect(results, step['expected'], reason: context);
              expect(error, step['expectedError'], reason: context);
            case 'applyChangeEvent':
              final result = applyChangeEventToResultWindowBuffer(
                buffer,
                changeEvent(step['changeEvent'] as Map<String, dynamic>),
              );
              expect(result.name, step['expected'], reason: context);
            case 'applyChangeEvents':
              final result = applyChangeEventsToResultWindowBuffer(
                buffer,
                (step['changeEvents'] as List<dynamic>)
                    .map((e) => changeEvent(e as Map<String, dynamic>))
                    .toList(),
              );
              expect(
                result.runFullQueryAgain
                    ? {'runFullQueryAgain': true}
                    : {
                      'runFullQueryAgain': false,
                      'changed': result.changed,
                      'results': ids(result.results),
                    },
                step['expected'],
                reason: context,
              );
            case 'inspect':
              expect(
                {
                  'buffer': ids(buffer.buffer),
                  'offset': buffer.offset,
                  'complete': buffer.complete,
                },
                step['expected'],
                reason: context,
              );
            default:
              fail('$context: unknown op');
          }
        }
      });
    }
  });

  test('recommended result window buffer size', () {
    for (final pair
        in cases['recommendedResultWindowBufferSize'] as List<dynamic>) {
      final limit = (pair as List<dynamic>)[0] as int?;
      expect(
        getRecommendedResultWindowBufferSize(limit),
        pair[1],
        reason: 'limit $limit',
      );
    }
  });
}
