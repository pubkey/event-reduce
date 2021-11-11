import { ResolverFunctions } from 'binary-decision-diagram';
import type { StateName, StateResolveFunction, StateSet, StateResolveFunctionInput } from '../types';
export * from './state-resolver';
/**
 * all states ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export declare const orderedStateList: StateName[];
export declare const stateResolveFunctions: {
    readonly [k in StateName]: StateResolveFunction<any>;
};
export declare const stateResolveFunctionByIndex: ResolverFunctions<StateResolveFunctionInput<any>>;
export declare function resolveState<DocType>(stateName: StateName, input: StateResolveFunctionInput<DocType>): boolean;
export declare function getStateSet<DocType>(input: StateResolveFunctionInput<DocType>): StateSet;
export declare function logStateSet(stateSet: StateSet): void;
