import type { ActionName, ActionFunction } from '../types/index.js';
export * from './action-functions.js';
/**
 * all actions ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export declare const orderedActionList: ActionName[];
/**
 * The action functions in the same order as orderedActionList.
 * Use this instead of actionFunctions to look up an action by its index,
 * so the action names do not end up in the bundle of the user.
 */
export declare const actionFunctionList: ActionFunction<any>[];
export declare const actionFunctions: {
    [k in ActionName]: ActionFunction<any>;
};
