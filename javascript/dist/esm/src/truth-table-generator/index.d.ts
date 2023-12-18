import type { StateActionIdMap, Procedure, Human } from './types.js';
import type { ActionName, ActionFunctionInput, MongoQuery } from '../types/index.js';
export * from './binary-state.js';
export * from './calculate-bdd-quality.js';
export * from './data-generator.js';
export * from './fuzzing.js';
export * from './procedures.js';
export * from './queries.js';
export type * from './types.js';
export * from './database/index.js';
export interface GenerateTruthTableInput {
    queries: MongoQuery[];
    procedures: Procedure[];
    table?: StateActionIdMap;
    log?: boolean;
}
export declare function generateTruthTable({ queries, procedures, table, log }: GenerateTruthTableInput): StateActionIdMap;
export declare function incrementTruthTableActions(table: Map<any, any> | undefined, queries: MongoQuery[], procedure: Procedure, log?: boolean): number;
export declare function getNextWorkingAction(input: ActionFunctionInput<Human>, resultAfter: Human[], lastWorkingActionId: number, log?: boolean): number;
/**
 * returns true if the action calculates the same
 * results as given
 */
export declare function doesActionWork(input: ActionFunctionInput<Human>, resultAfter: Human[], actionName: ActionName, log?: boolean): boolean;
