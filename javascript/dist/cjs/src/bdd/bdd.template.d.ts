import { PackedBdd } from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types/index.js';
export declare const packedBddString = "${packedBddString}";
export declare function getPackedBdd(): PackedBdd;
export declare const resolveInput: (input: StateResolveFunctionInput<any>) => number;
