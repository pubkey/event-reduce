import { StateSet } from '../types';
import { orderedStateList } from '../states';

export const FIRST_STATE_SET: StateSet = new Array(orderedStateList.length).fill(0).map(() => '0').join('');
export const LAST_STATE_SET: StateSet = new Array(orderedStateList.length).fill(0).map(() => '1').join('');

export function getNextStateSet(
    stateSet?: StateSet
) {
    if (!stateSet) {
        return FIRST_STATE_SET;
    }
    const decimal = binaryToDecimal(stateSet);
    const increase = decimal + 1;
    return decimalToBinary(increase);
}

/**
 * @link https://stackoverflow.com/a/16155417
 */
export function decimalToBinary(decimal: number) {
    return (decimal >>> 0).toString(2);
}

export function binaryToDecimal(binary: string): number {
    return parseInt(binary, 2);
}