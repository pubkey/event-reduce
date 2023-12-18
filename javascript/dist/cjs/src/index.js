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
const index_js_1 = require("./states/index.js");
const index_js_2 = require("./actions/index.js");
const bdd_generated_js_1 = require("./bdd/bdd.generated.js");
__exportStar(require("./states/index.js"), exports);
__exportStar(require("./util.js"), exports);
__exportStar(require("./actions/index.js"), exports);
function calculateActionFromMap(stateSetToActionMap, input) {
    const stateSet = (0, index_js_1.getStateSet)(input);
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
exports.calculateActionFromMap = calculateActionFromMap;
function calculateActionName(input) {
    const resolvedActionId = (0, bdd_generated_js_1.resolveInput)(input);
    return index_js_2.orderedActionList[resolvedActionId];
}
exports.calculateActionName = calculateActionName;
function calculateActionFunction(input) {
    const actionName = calculateActionName(input);
    return index_js_2.actionFunctions[actionName];
}
exports.calculateActionFunction = calculateActionFunction;
/**
 * for performance reasons,
 * @mutates the input
 * @returns the new results
 */
function runAction(action, queryParams, changeEvent, previousResults, keyDocumentMap) {
    const fn = index_js_2.actionFunctions[action];
    fn({
        queryParams,
        changeEvent,
        previousResults,
        keyDocumentMap
    });
    return previousResults;
}
exports.runAction = runAction;
//# sourceMappingURL=index.js.map