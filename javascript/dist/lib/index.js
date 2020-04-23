"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
var states_1 = require("./states");
var actions_1 = require("./actions");
var bdd_generated_1 = require("./bdd/bdd.generated");
__export(require("./states"));
__export(require("./util"));
function calculateActionFromMap(stateSetToActionMap, input) {
    var stateSet = states_1.getStateSet(input);
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
exports.calculateActionFromMap = calculateActionFromMap;
function calculateActionName(input) {
    var resolvedActionId = bdd_generated_1.resolveInput(input);
    return actions_1.orderedActionList[resolvedActionId];
}
exports.calculateActionName = calculateActionName;
function calculateActionFunction(input) {
    var actionName = calculateActionName(input);
    return actions_1.actionFunctions[actionName];
}
exports.calculateActionFunction = calculateActionFunction;
/**
 * for performance reasons,
 * @mutates the input
 * @returns the new results
 */
function runAction(action, queryParams, changeEvent, previousResults, keyDocumentMap) {
    var fn = actions_1.actionFunctions[action];
    fn({
        queryParams: queryParams,
        changeEvent: changeEvent,
        previousResults: previousResults,
        keyDocumentMap: keyDocumentMap
    });
    return previousResults;
}
exports.runAction = runAction;
//# sourceMappingURL=index.js.map