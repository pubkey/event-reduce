import {
    ActionName,
    ActionFunction
} from '../types';

import {
    doNothing,
    insertFirst,
    insertLast,
    removeFirstItem,
    removeLastItem, // TODO we need a test-case to provocate that (something with skip where hiddens are removed)
    removeFirstInsertLast,
    removeLastInsertFirst,
    removeExisting,
    replaceExisting,
    alwaysWrong,
    insertAtSortPosition,
    removeExistingAndInsertAtSortPosition,
    runFullQueryAgain,
    unknownAction
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
    'runFullQueryAgain',
    'unknownAction'
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
    removeExisting,
    replaceExisting,
    alwaysWrong,
    insertAtSortPosition,
    removeExistingAndInsertAtSortPosition,
    runFullQueryAgain,
    unknownAction
};
