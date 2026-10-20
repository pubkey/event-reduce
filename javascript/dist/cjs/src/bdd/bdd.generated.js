"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.packedBddString = void 0;
exports.getPackedBdd = getPackedBdd;
const binary_decision_diagram_1 = require("binary-decision-diagram");
const index_js_1 = require("../states/index.js");
exports.packedBddString = '1AQECAAMEBgUGBgd+BggJCAoLBQwNCA4PBxARBQwSBxMUBxUWEX5/EBJ+BxcYB4GMBRkaBBscEX6MCx0eBB8gCSEiBCMkCyUmBCcoDykqDysqBSwtBS4tBRkvCTAxCzIzBS40BTU2BTc4BTk6CjuMBX48CYeCCyiMBX49EX4+EX6AEX4/D0B+DxJ+D0F+CkJDBURFBUZHBSxICUlKCktMCk1OCk1PEYGDCjdQClFSClGMEYyDDH5TDH5UDop/DoqMEX5VEX6DD1YqDBpXClhZClhaCltcCltdCl5fBWBhBWJjD2R+DC1lEYGFD2Y3D1A3EYGMEYyFD2eMEH6BEH6MDoyEECtoD2lqEYeIEYeLD2tZEYKGEYJsEYJtD25+DC1vCnBSCnBxCnJzCnKMEBJ0D2RUEYGLEYyLEXV2ECt3ECo3EYdtDouEDouMEBJ4D3lUEYyID3qMEYyGEYxVEYx+Dn6BDop+EYF7EXx7EBJ9EYxtDox+Dn6MEYx7';
let packedBdd;
function getPackedBdd() {
    if (!packedBdd) {
        packedBdd = (0, binary_decision_diagram_1.packedBddFromBase64String)(exports.packedBddString);
    }
    return packedBdd;
}
const resolveInput = (input) => (0, binary_decision_diagram_1.resolveWithPackedBdd)(getPackedBdd(), index_js_1.stateResolveFunctionByIndex, input);
exports.resolveInput = resolveInput;
//# sourceMappingURL=bdd.generated.js.map