/// Returns the action that transforms the previous results into the new results.
/// If it is `.runFullQueryAgain`, the query must be run over the database again.
public func calculateActionName<D>(_ input: StateResolveFunctionInput<D>) -> ActionName {
    orderedActionList[resolveInput(input)]
}

/// Applies the action to the results, which are mutated in place.
/// The key document map is kept in sync with the results.
/// Throws `EventReduceError.runFullQueryAgain` and `EventReduceError.unknownAction`,
/// in that case the results are not changed.
public func runAction<D>(
    _ action: ActionName,
    queryParams: QueryParams<D>,
    changeEvent: ChangeEvent<D>,
    previousResults: inout [D],
    keyDocumentMap: inout ResultKeyDocumentMap<D>?
) throws {
    try actionFunction(action)(queryParams, changeEvent, &previousResults, &keyDocumentMap)
}

/// Applies the action to the results, which are mutated in place.
public func runAction<D>(
    _ action: ActionName,
    queryParams: QueryParams<D>,
    changeEvent: ChangeEvent<D>,
    previousResults: inout [D]
) throws {
    var keyDocumentMap: ResultKeyDocumentMap<D>? = nil
    try runAction(
        action, queryParams: queryParams, changeEvent: changeEvent,
        previousResults: &previousResults, keyDocumentMap: &keyDocumentMap)
}
