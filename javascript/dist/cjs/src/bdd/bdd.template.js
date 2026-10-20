"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.packedBddString = void 0;
exports.getPackedBdd = getPackedBdd;
const binary_decision_diagram_1 = require("binary-decision-diagram");
const index_js_1 = require("../states/index.js");
exports.packedBddString = '${packedBddString}';
let packedBdd;
function getPackedBdd() {
    if (!packedBdd) {
        packedBdd = (0, binary_decision_diagram_1.packedBddFromBase64String)(exports.packedBddString);
    }
    return packedBdd;
}
const resolveInput = (input) => (0, binary_decision_diagram_1.resolveWithPackedBdd)(getPackedBdd(), index_js_1.stateResolveFunctionByIndex, input);
exports.resolveInput = resolveInput;
//# sourceMappingURL=bdd.template.js.map