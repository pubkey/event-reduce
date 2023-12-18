import { getStateSet } from './states/index.js';
import { actionFunctions, orderedActionList } from './actions/index.js';
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
export function calculateActionFunction(input) {
    const actionName = calculateActionName(input);
    return actionFunctions[actionName];
}
/**
 * for performance reasons,
 * @mutates the input
 * @returns the new results
 */
export function runAction(action, queryParams, changeEvent, previousResults, keyDocumentMap) {
    const fn = actionFunctions[action];
    fn({
        queryParams,
        changeEvent,
        previousResults,
        keyDocumentMap
    });
    return previousResults;
}
//# sourceMappingURL=index.js.map