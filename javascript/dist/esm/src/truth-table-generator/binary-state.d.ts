import type { StateSet } from '../types/index.js';
export declare const STATE_SET_LENGTH: number;
export declare const FIRST_STATE_SET: StateSet;
export declare const LAST_STATE_SET: StateSet;
export declare function getNextStateSet(stateSet?: StateSet): string;
/**
 * @link https://stackoverflow.com/a/16155417
 */
export declare function decimalToPaddedBinary(decimal: number, padding?: number): string;
export declare function binaryToDecimal(binary: string): number;
export declare function maxBinaryWithLength(length: number): string;
export declare function oppositeBinary(i: string): string;
export declare function stateSetToObject(stateSet: StateSet): any;
