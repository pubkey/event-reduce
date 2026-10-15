import {
    decimalToPaddedBinary as decimalToPaddedBinaryOfBdd,
    getNextStateSet as getNextStateSetOfBdd
} from 'binary-decision-diagram';
import type { StateSet } from '../types/index.js';
import { orderedStateList } from '../states/index.js';

export const STATE_SET_LENGTH = orderedStateList.length;
export const FIRST_STATE_SET: StateSet = new Array(STATE_SET_LENGTH).fill(0).map(() => '0').join('');
export const LAST_STATE_SET: StateSet = new Array(STATE_SET_LENGTH).fill(0).map(() => '1').join('');

export {
    binaryToDecimal,
    maxBinaryWithLength,
    oppositeBinary
} from 'binary-decision-diagram';

export function getNextStateSet(
    stateSet?: StateSet
): StateSet {
    if (!stateSet) {
        return FIRST_STATE_SET;
    }
    return getNextStateSetOfBdd(stateSet);
}

export function decimalToPaddedBinary(
    decimal: number,
    padding: number = STATE_SET_LENGTH
): string {
    return decimalToPaddedBinaryOfBdd(decimal, padding);
}

export function stateSetToObject(stateSet: StateSet): any {
    const ret: any = {};
    let i = 0;
    orderedStateList.forEach(s => {
        ret[s] = stateSet[i];
        i++;
    });
    return ret;
}
