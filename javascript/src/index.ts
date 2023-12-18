import type {
    ChangeEvent,
    ActionName,
    ResultKeyDocumentMap,
    QueryParams,
    StateSetToActionMap,
    StateSet,
    ActionFunction,
    StateResolveFunctionInput
} from './types/index.js';
import { getStateSet } from './states/index.js';
import { actionFunctions, orderedActionList } from './actions/index.js';
import { resolveInput } from './bdd/bdd.generated.js';

/**
 * Export as type to ensure we do not
 * end with an import statement in the build output
 * which would increase the build size.
 */
export type {
    ActionFunction,
    ActionFunctionInput,
    ActionName,
    ChangeEvent,
    ChangeEventBase,
    ChangeEventDelete,
    ChangeEventInsert,
    ChangeEventUpdate,
    MongoQuery,
    QueryMatcher,
    QueryParams,
    ResultKeyDocumentMap,
    DeterministicSortComparator,
    StateName,
    StateResolveFunction,
    StateResolveFunctionInput,
    StateSet,
    StateSetToActionMap,
    WriteOperation
} from './types/index.js';

export * from './states/index.js';
export * from './util.js';
export * from './actions/index.js';

export function calculateActionFromMap<DocType>(
    stateSetToActionMap: StateSetToActionMap,
    input: StateResolveFunctionInput<DocType>
): {
    action: ActionName,
    stateSet: StateSet
} {
    const stateSet: StateSet = getStateSet(input);
    const actionName = stateSetToActionMap.get(stateSet);
    if (!actionName) {
        return {
            action: 'runFullQueryAgain',
            stateSet
        };
    } else {
        return {
            action: actionName,
            stateSet
        };
    }
}

export function calculateActionName<DocType>(
    input: StateResolveFunctionInput<DocType>
): ActionName {
    const resolvedActionId = resolveInput(
        input
    );
    return orderedActionList[resolvedActionId];
}

export function calculateActionFunction<DocType>(
    input: StateResolveFunctionInput<DocType>
): ActionFunction<DocType> {
    const actionName = calculateActionName(input);
    return actionFunctions[actionName];
}

/**
 * for performance reasons,
 * @mutates the input
 * @returns the new results
 */
export function runAction<DocType>(
    action: ActionName,
    queryParams: QueryParams<DocType>,
    changeEvent: ChangeEvent<DocType>,
    previousResults: DocType[],
    keyDocumentMap?: ResultKeyDocumentMap<DocType>
): DocType[] {
    const fn: ActionFunction<DocType> = actionFunctions[action];
    fn({
        queryParams,
        changeEvent,
        previousResults,
        keyDocumentMap
    });
    return previousResults;
}
