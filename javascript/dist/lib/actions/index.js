"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var action_functions_1 = require("./action-functions");
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
    'removeExisting',
    'replaceExisting',
    'alwaysWrong',
    'insertAtSortPosition',
    'removeExistingAndInsertAtSortPosition',
    'runFullQueryAgain',
    'unknownAction'
];
exports.actionFunctions = {
    doNothing: action_functions_1.doNothing,
    insertFirst: action_functions_1.insertFirst,
    insertLast: action_functions_1.insertLast,
    removeFirstItem: action_functions_1.removeFirstItem,
    removeLastItem: action_functions_1.removeLastItem,
    removeFirstInsertLast: action_functions_1.removeFirstInsertLast,
    removeLastInsertFirst: action_functions_1.removeLastInsertFirst,
    removeExisting: action_functions_1.removeExisting,
    replaceExisting: action_functions_1.replaceExisting,
    alwaysWrong: action_functions_1.alwaysWrong,
    insertAtSortPosition: action_functions_1.insertAtSortPosition,
    removeExistingAndInsertAtSortPosition: action_functions_1.removeExistingAndInsertAtSortPosition,
    runFullQueryAgain: action_functions_1.runFullQueryAgain,
    unknownAction: action_functions_1.unknownAction
};
//# sourceMappingURL=index.js.map