"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oppositeBinary = exports.maxBinaryWithLength = exports.binaryToDecimal = exports.LAST_STATE_SET = exports.FIRST_STATE_SET = exports.STATE_SET_LENGTH = void 0;
exports.getNextStateSet = getNextStateSet;
exports.decimalToPaddedBinary = decimalToPaddedBinary;
exports.stateSetToObject = stateSetToObject;
const binary_decision_diagram_1 = require("binary-decision-diagram");
const index_js_1 = require("../states/index.js");
exports.STATE_SET_LENGTH = index_js_1.orderedStateList.length;
exports.FIRST_STATE_SET = new Array(exports.STATE_SET_LENGTH).fill(0).map(() => '0').join('');
exports.LAST_STATE_SET = new Array(exports.STATE_SET_LENGTH).fill(0).map(() => '1').join('');
var binary_decision_diagram_2 = require("binary-decision-diagram");
Object.defineProperty(exports, "binaryToDecimal", { enumerable: true, get: function () { return binary_decision_diagram_2.binaryToDecimal; } });
Object.defineProperty(exports, "maxBinaryWithLength", { enumerable: true, get: function () { return binary_decision_diagram_2.maxBinaryWithLength; } });
Object.defineProperty(exports, "oppositeBinary", { enumerable: true, get: function () { return binary_decision_diagram_2.oppositeBinary; } });
function getNextStateSet(stateSet) {
    if (!stateSet) {
        return exports.FIRST_STATE_SET;
    }
    return (0, binary_decision_diagram_1.getNextStateSet)(stateSet);
}
function decimalToPaddedBinary(decimal, padding = exports.STATE_SET_LENGTH) {
    return (0, binary_decision_diagram_1.decimalToPaddedBinary)(decimal, padding);
}
function stateSetToObject(stateSet) {
    const ret = {};
    let i = 0;
    index_js_1.orderedStateList.forEach(s => {
        ret[s] = stateSet[i];
        i++;
    });
    return ret;
}
//# sourceMappingURL=binary-state.js.map