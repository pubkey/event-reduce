import type { StateSet } from '../types/index.js';
export declare const STATE_SET_LENGTH: number;
export declare const FIRST_STATE_SET: StateSet;
export declare const LAST_STATE_SET: StateSet;
export { binaryToDecimal, maxBinaryWithLength, oppositeBinary } from 'binary-decision-diagram';
export declare function getNextStateSet(stateSet?: StateSet): StateSet;
export declare function decimalToPaddedBinary(decimal: number, padding?: number): string;
export declare function stateSetToObject(stateSet: StateSet): any;
