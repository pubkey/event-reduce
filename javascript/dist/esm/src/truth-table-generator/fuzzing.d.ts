import type { MongoQuery } from '../types/index.js';
import type { Procedure, StateActionIdMap } from './types.js';
export type FuzzingReturn = {
    ok: boolean;
    query: MongoQuery;
    procedure: Procedure;
    amountOfHandled: number;
    amountOfOptimized: number;
};
/**
 * randomly generates queries and events
 * and returns on the first broken one
 *
 * returns ok:true if no problem was found
 */
export declare function fuzzing(table: StateActionIdMap, queriesAmount?: number, eventsAmount?: number): FuzzingReturn;
