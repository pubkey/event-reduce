import { doNothing, insertFirst, insertLast, removeFirstItem, removeLastItem, removeFirstInsertLast, removeLastInsertFirst, removeExisting, replaceExisting, alwaysWrong, insertAtSortPosition, removeExistingAndInsertAtSortPosition, runFullQueryAgain, unknownAction, removeFirstInsertFirst, removeLastInsertLast } from './action-functions.js';
export * from './action-functions.js';
/**
 * all actions ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export const orderedActionList = [
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
export const actionFunctions = {
    doNothing,
    insertFirst,
    insertLast,
    removeFirstItem,
    removeLastItem,
    removeFirstInsertLast,
    removeLastInsertFirst,
    removeFirstInsertFirst,
    removeLastInsertLast,
    removeExisting,
    replaceExisting,
    alwaysWrong,
    insertAtSortPosition,
    removeExistingAndInsertAtSortPosition,
    runFullQueryAgain,
    unknownAction
};
//# sourceMappingURL=index.js.map