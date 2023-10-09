"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stateSetToObject = exports.oppositeBinary = exports.maxBinaryWithLength = exports.binaryToDecimal = exports.decimalToPaddedBinary = exports.getNextStateSet = exports.LAST_STATE_SET = exports.FIRST_STATE_SET = exports.STATE_SET_LENGTH = void 0;
const index_js_1 = require("../states/index.js");
exports.STATE_SET_LENGTH = index_js_1.orderedStateList.length;
exports.FIRST_STATE_SET = new Array(exports.STATE_SET_LENGTH).fill(0).map(() => '0').join('');
exports.LAST_STATE_SET = new Array(exports.STATE_SET_LENGTH).fill(0).map(() => '1').join('');
function getNextStateSet(stateSet) {
    if (!stateSet) {
        return exports.FIRST_STATE_SET;
    }
    const decimal = binaryToDecimal(stateSet);
    const increase = decimal + 1;
    const binary = decimalToPaddedBinary(increase);
    return binary;
}
exports.getNextStateSet = getNextStateSet;
/**
 * @link https://stackoverflow.com/a/16155417
 */
function decimalToPaddedBinary(decimal, padding = exports.STATE_SET_LENGTH) {
    const binary = (decimal >>> 0).toString(2);
    const padded = binary.padStart(padding, '0');
    return padded;
}
exports.decimalToPaddedBinary = decimalToPaddedBinary;
function binaryToDecimal(binary) {
    return parseInt(binary, 2);
}
exports.binaryToDecimal = binaryToDecimal;
function maxBinaryWithLength(length) {
    return new Array(length).fill(0).map(() => '1').join('');
}
exports.maxBinaryWithLength = maxBinaryWithLength;
function oppositeBinary(i) {
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
exports.oppositeBinary = oppositeBinary;
function stateSetToObject(stateSet) {
    const ret = {};
    let i = 0;
    index_js_1.orderedStateList.forEach(s => {
        ret[s] = stateSet[i];
        i++;
    });
    return ret;
}
exports.stateSetToObject = stateSetToObject;
//# sourceMappingURL=binary-state.js.map