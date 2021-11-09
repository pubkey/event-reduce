"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.getSimpleBdd = exports.minimalBddString = void 0;
var binary_decision_diagram_1 = require("binary-decision-diagram");
var states_1 = require("../states");
exports.minimalBddString = '${minimalBddString}';
var simpleBdd;
function getSimpleBdd() {
    if (!simpleBdd) {
        simpleBdd = (0, binary_decision_diagram_1.minimalStringToSimpleBdd)(exports.minimalBddString);
    }
    return simpleBdd;
}
exports.getSimpleBdd = getSimpleBdd;
var resolveInput = function (input) {
    return (0, binary_decision_diagram_1.resolveWithSimpleBdd)(getSimpleBdd(), states_1.stateResolveFunctionByIndex, input);
};
exports.resolveInput = resolveInput;
//# sourceMappingURL=bdd.template.js.map