import {
    ActionName,
    ActionFunction,
    StateName
} from "../types";

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
    'removeExisting',
    'replaceExisting',
    'insertAtSortPosition',
    'removeExistingAndInsertAtSortPosition',
    'runFullQueryAgain'
];


export const actionFunctions: {
    [k: string]: ActionFunction<any>
} = {
};