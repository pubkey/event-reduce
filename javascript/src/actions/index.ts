import {
    ActionName,
    ActionFunction
} from '../types';

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
    runFullQueryAgain
} from './action-functions';

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
    'removeExisting',
    'replaceExisting',
    'alwaysWrong',
    'insertAtSortPosition',
    'removeExistingAndInsertAtSortPosition',
    'runFullQueryAgain'
];


export const actionFunctions: {
    [k: string]: ActionFunction<any>
} = {
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
    runFullQueryAgain
};
