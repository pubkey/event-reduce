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
import { actionFunctionList, orderedActionList } from './actions/index.js';
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
    DocumentId,
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
export * from './result-window-buffer.js';

/**
 * Like in SQL, a query with limit 0 returns no documents.
 * No change event can change its empty results, so the action is always doNothing.
 * This also makes a limit that was calculated to 0 by mistake
 * return nothing instead of all documents.
 * A negative limit is always a mistake and throws.
 * Returns true if the query has the limit 0.
 */
function isLimitZero(queryParams: QueryParams<any>): boolean {
    const limit = queryParams.limit;
    if (typeof limit === 'number' && limit <= 0) {
        if (limit < 0) {
            throw new Error('EventReduce:NEG_LIMIT');
        }
        return true;
    }
    return false;
}

/**
 * The index of doNothing in orderedActionList and actionFunctionList.
 */
const DO_NOTHING_ACTION_ID = 0;

function resolveActionId<DocType>(input: StateResolveFunctionInput<DocType>): number {
    return isLimitZero(input.queryParams) ? DO_NOTHING_ACTION_ID : resolveInput(input);
}

export function calculateActionFromMap<DocType>(
    stateSetToActionMap: StateSetToActionMap,
    input: StateResolveFunctionInput<DocType>
): {
    action: ActionName,
    stateSet: StateSet
} {
    const stateSet: StateSet = getStateSet(input);
    if (isLimitZero(input.queryParams)) {
        return {
            action: 'doNothing',
            stateSet
        };
    }
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
    return orderedActionList[resolveActionId(input)];
}

/**
 * Like calculateActionName() but returns the action function directly.
 * Prefer this one when bundle size matters, because it does not
 * pull the action names into the bundle.
 */
export function calculateActionFunction<DocType>(
    input: StateResolveFunctionInput<DocType>
): ActionFunction<DocType> {
    return actionFunctionList[resolveActionId(input)];
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
    const fn: ActionFunction<DocType> | undefined = actionFunctionList[orderedActionList.indexOf(action)];
    if (!fn) {
        throw new Error('EventReduce:UNK_ACT ' + action);
    }
    fn({
        queryParams,
        changeEvent,
        previousResults,
        keyDocumentMap
    });
    return previousResults;
}
