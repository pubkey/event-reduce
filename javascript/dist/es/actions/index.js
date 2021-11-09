import { doNothing, insertFirst, insertLast, removeFirstItem, removeLastItem, removeFirstInsertLast, removeLastInsertFirst, removeExisting, replaceExisting, alwaysWrong, insertAtSortPosition, removeExistingAndInsertAtSortPosition, runFullQueryAgain, unknownAction, removeFirstInsertFirst, removeLastInsertLast } from './action-functions';
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
export var actionFunctions = {
    doNothing: doNothing,
    insertFirst: insertFirst,
    insertLast: insertLast,
    removeFirstItem: removeFirstItem,
    removeLastItem: removeLastItem,
    removeFirstInsertLast: removeFirstInsertLast,
    removeLastInsertFirst: removeLastInsertFirst,
    removeFirstInsertFirst: removeFirstInsertFirst,
    removeLastInsertLast: removeLastInsertLast,
    removeExisting: removeExisting,
    replaceExisting: replaceExisting,
    alwaysWrong: alwaysWrong,
    insertAtSortPosition: insertAtSortPosition,
    removeExistingAndInsertAtSortPosition: removeExistingAndInsertAtSortPosition,
    runFullQueryAgain: runFullQueryAgain,
    unknownAction: unknownAction
};
//# sourceMappingURL=index.js.map