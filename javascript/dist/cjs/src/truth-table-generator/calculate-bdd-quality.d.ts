import { RootNode } from 'binary-decision-diagram';
import type { MongoQuery, StateName } from '../types/index.js';
import type { Procedure } from './types.js';
export type PerformanceMeasurement = {
    [k in StateName]: number;
};
/**
 * measure how much cpu each of the state functions needs
 */
export declare function measurePerformanceOfStateFunctions(rounds?: number): Promise<PerformanceMeasurement>;
/**
 * Comparator used to find the best sort-order of the boolean functions.
 * In the past we just used the bdd with the least amount of nodes.
 * But not all state-functions need the same performance so we optimize
 * to use the least amount of cpu cycles
 *
 * @returns the better bdd
 */
export declare function getBetterBdd(a: RootNode, b: RootNode, perfMeasurement: PerformanceMeasurement, queries: MongoQuery[], procedures: Procedure[]): Promise<RootNode>;
export type FunctionUsageCount = {
    [k in StateName]: number;
};
export declare function countFunctionUsages(bdd: RootNode, queries: MongoQuery[], procedures: Procedure[]): FunctionUsageCount;
/**
 * returns the quality of the BDD,
 * the higher the better
 */
export declare const QUALITY_BY_BDD_CACHE: WeakMap<RootNode, number>;
export declare function getQualityOfBdd(bdd: RootNode, perfMeasurement: PerformanceMeasurement, queries: MongoQuery[], procedures: Procedure[]): number;
