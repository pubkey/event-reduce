"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var binary_decision_diagram_1 = require("binary-decision-diagram");
var states_1 = require("../states");
exports.minimalBddString = '${minimalBddString}';
exports.simpleBdd = binary_decision_diagram_1.minimalStringToSimpleBdd(exports.minimalBddString);
exports.resolveInput = function (input) { return binary_decision_diagram_1.resolveWithSimpleBdd(exports.simpleBdd, states_1.stateResolveFunctionByIndex, input); };
//# sourceMappingURL=bdd.template.js.map