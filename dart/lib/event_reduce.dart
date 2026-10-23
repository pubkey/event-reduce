/// EventReduce: update live query results from change events without re-running the query.
library;

import 'src/actions.dart';
import 'src/bdd.dart';
import 'src/types.dart';

export 'src/actions.dart';
export 'src/bdd.dart' show packedBdd, packedBddString, resolveInput;
export 'src/result_window_buffer.dart';
export 'src/states.dart';
export 'src/types.dart';
export 'src/util.dart';

/// Returns the action that transforms the previous results into the new results.
/// If it is [ActionName.runFullQueryAgain], the query must be run over the database again.
ActionName calculateActionName<D>(StateResolveFunctionInput<D> input) =>
    orderedActionList[resolveInput(input)];

/// Like [calculateActionName] but returns the action function directly.
ActionFunction<D> calculateActionFunction<D>(
        StateResolveFunctionInput<D> input) =>
    actionFunction<D>(calculateActionName(input));

/// Applies the action to the results.
/// For performance reasons, it mutates [previousResults]
/// and the [keyDocumentMap] and returns the mutated results.
/// Throws an [EventReduceError] for [ActionName.runFullQueryAgain]
/// and [ActionName.unknownAction].
List<D> runAction<D>(
  ActionName action,
  QueryParams<D> queryParams,
  ChangeEvent<D> changeEvent,
  List<D> previousResults, [
  ResultKeyDocumentMap<D>? keyDocumentMap,
]) {
  actionFunction<D>(action)(StateResolveFunctionInput(
    queryParams: queryParams,
    changeEvent: changeEvent,
    previousResults: previousResults,
    keyDocumentMap: keyDocumentMap,
  ));
  return previousResults;
}
