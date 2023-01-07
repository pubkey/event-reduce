"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runAction = exports.calculateActionFunction = exports.calculateActionName = exports.calculateActionFromMap = void 0;
var states_1 = require("./states");
var actions_1 = require("./actions");
var bdd_generated_1 = require("./bdd/bdd.generated");
__exportStar(require("./states"), exports);
__exportStar(require("./util"), exports);
function calculateActionFromMap(stateSetToActionMap, input) {
    var stateSet = (0, states_1.getStateSet)(input);
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
    var resolvedActionId = (0, bdd_generated_1.resolveInput)(input);
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