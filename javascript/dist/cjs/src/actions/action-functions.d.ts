import type { ActionFunction } from '../types/index.js';
export declare const doNothing: ActionFunction<any>;
export declare const insertFirst: ActionFunction<any>;
export declare const insertLast: ActionFunction<any>;
export declare const removeFirstItem: ActionFunction<any>;
export declare const removeLastItem: ActionFunction<any>;
export declare const removeFirstInsertLast: ActionFunction<any>;
export declare const removeLastInsertFirst: ActionFunction<any>;
export declare const removeFirstInsertFirst: ActionFunction<any>;
export declare const removeLastInsertLast: ActionFunction<any>;
export declare const removeExisting: ActionFunction<any>;
export declare const replaceExisting: ActionFunction<any>;
/**
 * this function always returns wrong results
 * it must be later optimised out
 * otherwise there is something broken
 */
export declare const alwaysWrong: ActionFunction<any>;
export declare const insertAtSortPosition: ActionFunction<any>;
export declare const removeExistingAndInsertAtSortPosition: ActionFunction<any>;
export declare const runFullQueryAgain: ActionFunction<any>;
export declare const unknownAction: ActionFunction<any>;
