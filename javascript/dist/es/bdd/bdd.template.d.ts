import { SimpleBdd } from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types';
export declare const minimalBddString = "${minimalBddString}";
export declare function getSimpleBdd(): SimpleBdd;
export declare const resolveInput: (input: StateResolveFunctionInput<any>) => number;
