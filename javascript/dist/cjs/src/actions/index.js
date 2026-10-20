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
exports.actionFunctions = exports.orderedActionList = void 0;
const action_functions_js_1 = require("./action-functions.js");
__exportStar(require("./action-functions.js"), exports);
/**
 * all actions ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
exports.orderedActionList = [
    'doNothing',
    'insertFirst',
    'insertLast',
    'removeFirstItem',
    'removeLastItem',
    'removeFirstInsertLast',
    'removeLastInsertFirst',
    'removeFirstInsertFirst',
    'removeLastInsertLast',
    'removeExisting',
    'replaceExisting',
    'alwaysWrong',
    'insertAtSortPosition',
    'removeExistingAndInsertAtSortPosition',
    'runFullQueryAgain',
    'unknownAction'
];
exports.actionFunctions = {
    doNothing: action_functions_js_1.doNothing,
    insertFirst: action_functions_js_1.insertFirst,
    insertLast: action_functions_js_1.insertLast,
    removeFirstItem: action_functions_js_1.removeFirstItem,
    removeLastItem: action_functions_js_1.removeLastItem,
    removeFirstInsertLast: action_functions_js_1.removeFirstInsertLast,
    removeLastInsertFirst: action_functions_js_1.removeLastInsertFirst,
    removeFirstInsertFirst: action_functions_js_1.removeFirstInsertFirst,
    removeLastInsertLast: action_functions_js_1.removeLastInsertLast,
    removeExisting: action_functions_js_1.removeExisting,
    replaceExisting: action_functions_js_1.replaceExisting,
    alwaysWrong: action_functions_js_1.alwaysWrong,
    insertAtSortPosition: action_functions_js_1.insertAtSortPosition,
    removeExistingAndInsertAtSortPosition: action_functions_js_1.removeExistingAndInsertAtSortPosition,
    runFullQueryAgain: action_functions_js_1.runFullQueryAgain,
    unknownAction: action_functions_js_1.unknownAction
};
//# sourceMappingURL=index.js.map