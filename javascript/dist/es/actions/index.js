import { doNothing, insertFirst, insertLast, removeFirstItem, removeLastItem, removeFirstInsertLast, removeLastInsertFirst, removeExisting, replaceExisting, alwaysWrong, insertAtSortPosition, removeExistingAndInsertAtSortPosition, runFullQueryAgain, unknownAction } from './action-functions';
/**
 * all actions ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export var orderedActionList = [
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
export var actionFunctions = {
    doNothing: doNothing,
    insertFirst: insertFirst,
    insertLast: insertLast,
    removeFirstItem: removeFirstItem,
    removeLastItem: removeLastItem,
    removeFirstInsertLast: removeFirstInsertLast,
    removeLastInsertFirst: removeLastInsertFirst,
    removeExisting: removeExisting,
    replaceExisting: replaceExisting,
    alwaysWrong: alwaysWrong,
    insertAtSortPosition: insertAtSortPosition,
    removeExistingAndInsertAtSortPosition: removeExistingAndInsertAtSortPosition,
    runFullQueryAgain: runFullQueryAgain,
    unknownAction: unknownAction
};
//# sourceMappingURL=index.js.map