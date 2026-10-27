package com.github.pubkey.eventreduce

/**
 * Returns the action that transforms the previous results into the new results.
 * If it is [ActionName.RunFullQueryAgain], the query must be run over the database again.
 */
public fun <D> calculateActionName(input: StateResolveFunctionInput<D>): ActionName =
    orderedActionList[resolveInput(input)]

/**
 * Applies the action to the results.
 * For performance reasons, it mutates [previousResults] and the [keyDocumentMap]
 * and returns the mutated results.
 * Throws an [EventReduceException] for [ActionName.RunFullQueryAgain] and [ActionName.UnknownAction].
 */
public fun <D> runAction(
    action: ActionName,
    queryParams: QueryParams<D>,
    changeEvent: ChangeEvent<D>,
    previousResults: MutableList<D>,
    keyDocumentMap: MutableMap<String, D>? = null,
): MutableList<D> {
    actionFunction<D>(action)(ActionFunctionInput(queryParams, changeEvent, previousResults, keyDocumentMap))
    return previousResults
}
