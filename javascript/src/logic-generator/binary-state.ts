import { StateSet } from '../types';
import { orderedStateList } from '../states';

export const STATE_SET_LENGTH = orderedStateList.length;
export const FIRST_STATE_SET: StateSet = new Array(STATE_SET_LENGTH).fill(0).map(() => '0').join('');
export const LAST_STATE_SET: StateSet = new Array(STATE_SET_LENGTH).fill(0).map(() => '1').join('');

export function getNextStateSet(
    stateSet?: StateSet
) {
    if (!stateSet) {
        return FIRST_STATE_SET;
    }
    const decimal = binaryToDecimal(stateSet);
    const increase = decimal + 1;
    const binary = decimalToPaddedBinary(increase);
    return binary;
}

/**
 * @link https://stackoverflow.com/a/16155417
 */
export function decimalToPaddedBinary(decimal: number) {
    const binary = (decimal >>> 0).toString(2);
    const padded = binary.padStart(STATE_SET_LENGTH, '0');
    return padded;
}

export function binaryToDecimal(binary: string): number {
    return parseInt(binary, 2);
}