import { getStateSet } from './states';
import { actionFunctions, orderedActionList } from './actions';
import { resolveInput } from './bdd/bdd.generated';
export * from './states';
export * from './util';
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