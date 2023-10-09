import { orderedStateList } from '../states/index.js';
export const STATE_SET_LENGTH = orderedStateList.length;
export const FIRST_STATE_SET = new Array(STATE_SET_LENGTH).fill(0).map(() => '0').join('');
export const LAST_STATE_SET = new Array(STATE_SET_LENGTH).fill(0).map(() => '1').join('');
export function getNextStateSet(stateSet) {
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
export function decimalToPaddedBinary(decimal, padding = STATE_SET_LENGTH) {
    const binary = (decimal >>> 0).toString(2);
    const padded = binary.padStart(padding, '0');
    return padded;
}
export function binaryToDecimal(binary) {
    return parseInt(binary, 2);
}
export function maxBinaryWithLength(length) {
    return new Array(length).fill(0).map(() => '1').join('');
}
export function oppositeBinary(i) {
    if (i === '1') {
        return '0';
    }
    else if (i === '0') {
        return '1';
    }
    else {
        throw new Error('non-binary given');
    }
}
export function stateSetToObject(stateSet) {
    const ret = {};
    let i = 0;
    orderedStateList.forEach(s => {
        ret[s] = stateSet[i];
        i++;
    });
    return ret;
}
//# sourceMappingURL=binary-state.js.map