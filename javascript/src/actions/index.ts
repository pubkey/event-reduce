import type {
    ActionName,
    ActionFunction
} from '../types/index.js';

import {
    doNothing,
    insertFirst,
    insertLast,
    removeFirstItem,
    removeLastItem,
    removeFirstInsertLast,
    removeLastInsertFirst,
    removeExisting,
    replaceExisting,
    alwaysWrong,
    insertAtSortPosition,
    removeExistingAndInsertAtSortPosition,
    runFullQueryAgain,
    unknownAction,
    removeFirstInsertFirst,
    removeLastInsertLast
} from './action-functions.js';

export * from './action-functions.js';

/**
 * all actions ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export const orderedActionList: ActionName[] = [
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
 * alwaysWrong is only used by the truth-table generator and never
 * returned by the BDD, so it is replaced by unknownAction here
 * to not have it in the bundle of the user.
 */
export const actionFunctionList: ActionFunction<any>[] = [
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
    unknownAction,
    insertAtSortPosition,
    removeExistingAndInsertAtSortPosition,
    runFullQueryAgain,
    unknownAction
];

export const actionFunctions: {
    [k in ActionName]: ActionFunction<any>
} = {
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
