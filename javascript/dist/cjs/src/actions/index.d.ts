import type { ActionName, ActionFunction } from '../types/index.js';
export * from './action-functions.js';
/**
 * all actions ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export declare const orderedActionList: ActionName[];
export declare const actionFunctions: {
    [k in ActionName]: ActionFunction<any>;
};
