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
/**
 * The action functions in the same order as orderedActionList.
 * Use this instead of actionFunctions to look up an action by its index,
 * so the action names do not end up in the bundle of the user.
 */
export const actionFunctionList = [
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