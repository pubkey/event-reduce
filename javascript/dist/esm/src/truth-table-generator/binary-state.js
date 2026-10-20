import { decimalToPaddedBinary as decimalToPaddedBinaryOfBdd, getNextStateSet as getNextStateSetOfBdd } from 'binary-decision-diagram';
import { orderedStateList } from '../states/index.js';
export const STATE_SET_LENGTH = orderedStateList.length;
export const FIRST_STATE_SET = new Array(STATE_SET_LENGTH).fill(0).map(() => '0').join('');
export const LAST_STATE_SET = new Array(STATE_SET_LENGTH).fill(0).map(() => '1').join('');
export { binaryToDecimal, maxBinaryWithLength, oppositeBinary } from 'binary-decision-diagram';
export function getNextStateSet(stateSet) {
    if (!stateSet) {
        return FIRST_STATE_SET;
    }
    return getNextStateSetOfBdd(stateSet);
}
export function decimalToPaddedBinary(decimal, padding = STATE_SET_LENGTH) {
    return decimalToPaddedBinaryOfBdd(decimal, padding);
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