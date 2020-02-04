import * as fs from 'fs';

import { StateSet, StateName } from '../types';
import { orderedStateList } from '../states';
import { VALID_STATE_SET_PATH } from './config';

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

export function oppositeBinary(i: string): string {
    if (i === '1') {
        return '0';
    } else if (i === '0') {
        return '1';
    } else {
        throw new Error('non-binary given');
    }
}

export function isStateOperation(state: StateName): boolean {
    return ['isDelete', 'isInsert', 'isUpdate'].includes(state);
}

/**
 * some states can logically never be reached
 * so we do not have to calculate the best action for them
 *
 * Basically we can anyway only validate states that
 * can be reached with our query-procedure combination
 */
let VALID_STATES_CACHE: Set<StateSet>;
export function isStateSetReachable(stateSet: StateSet): boolean {
    if (!VALID_STATES_CACHE) {
        const content = fs.readFileSync(
            VALID_STATE_SET_PATH,
            'utf-8'
        );
        const parsed: StateSet[] = JSON.parse(content);
        VALID_STATES_CACHE = new Set();
        parsed.forEach(s => VALID_STATES_CACHE.add(s));
    }
    return VALID_STATES_CACHE.has(stateSet);
}

export function stateSetToObject(stateSet: StateSet): any {
    const ret = {};
    let i = 0;
    orderedStateList.forEach(s => {
        ret[s] = stateSet[i];
        i++;
    });
    return ret;
}
