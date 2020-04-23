import { getStateSet } from './states';
import { actionFunctions, orderedActionList } from './actions';
import { resolveInput } from './bdd/bdd.generated';
export * from './states';
export * from './util';
export function calculateActionFromMap(stateSetToActionMap, input) {
    var stateSet = getStateSet(input);
    var actionName = stateSetToActionMap.get(stateSet);
    if (!actionName) {
        return {
            action: 'runFullQueryAgain',
            stateSet: stateSet
        };
    }
    else {
        return {
            action: actionName,
            stateSet: stateSet
        };
    }
}
export function calculateActionName(input) {
    var resolvedActionId = resolveInput(input);
    return orderedActionList[resolvedActionId];
}
export function calculateActionFunction(input) {
    var actionName = calculateActionName(input);
    return actionFunctions[actionName];
}
/**
 * for performance reasons,
 * @mutates the input
 * @returns the new results
 */
export function runAction(action, queryParams, changeEvent, previousResults, keyDocumentMap) {
    var fn = actionFunctions[action];
    fn({
        queryParams: queryParams,
        changeEvent: changeEvent,
        previousResults: previousResults,
        keyDocumentMap: keyDocumentMap
    });
    return previousResults;
}
//# sourceMappingURL=index.js.map