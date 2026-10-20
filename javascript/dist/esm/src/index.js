import { getStateSet } from './states/index.js';
import { actionFunctionList, orderedActionList } from './actions/index.js';
import { resolveInput } from './bdd/bdd.generated.js';
export * from './states/index.js';
export * from './util.js';
export * from './actions/index.js';
export function calculateActionFromMap(stateSetToActionMap, input) {
    const stateSet = getStateSet(input);
    const actionName = stateSetToActionMap.get(stateSet);
    if (!actionName) {
        return {
            action: 'runFullQueryAgain',
            stateSet
        };
    }
    else {
        return {
            action: actionName,
            stateSet
        };
    }
}
export function calculateActionName(input) {
    const resolvedActionId = resolveInput(input);
    return orderedActionList[resolvedActionId];
}
/**
 * Like calculateActionName() but returns the action function directly.
 * Prefer this one when bundle size matters, because it does not
 * pull the action names into the bundle.
 */
export function calculateActionFunction(input) {
    return actionFunctionList[resolveInput(input)];
}
/**
 * for performance reasons,
 * @mutates the input
 * @returns the new results
 */
export function runAction(action, queryParams, changeEvent, previousResults, keyDocumentMap) {
    const fn = actionFunctionList[orderedActionList.indexOf(action)];
    fn({
        queryParams,
        changeEvent,
        previousResults,
        keyDocumentMap
    });
    return previousResults;
}
//# sourceMappingURL=index.js.map