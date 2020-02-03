import { StateSet, StateName } from '../types';
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

const OPERATION_INDEXES: number[] = orderedStateList
    .filter(state => isStateOperation(state))
    .map(state => {
        const index = orderedStateList.findIndex(s => s === state);
        return index;
    });

const HAS_LIMIT_INDEX = orderedStateList.findIndex(s => s === 'hasLimit');
const WAS_LIMIT_REACHED_INDEX = orderedStateList.findIndex(s => s === 'wasLimitReached');

/**
 * some states can logically never be reached
 * so we do not have to calculate the best action for them
 */
export function isStateSetReachable(stateSet: StateSet): boolean {
    // operation can either be insert, update or delete
    let operationTrues = 0;
    OPERATION_INDEXES.forEach(i => {
        const v = stateSet[i];
        if (v === '1') {
            operationTrues++;
        }
    });
    if (operationTrues !== 1) {
        return false;
    }

    // if hasLimit is false, wasLimitReached is also
    const hasLimit = stateSet[HAS_LIMIT_INDEX];
    const wasLimitReached = stateSet[WAS_LIMIT_REACHED_INDEX];
    if (hasLimit === '0' && wasLimitReached === '0') {
        return false;
    }


    return true;
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
