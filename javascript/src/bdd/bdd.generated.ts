import {
    PackedBdd,
    packedBddFromBase64String,
    resolveWithPackedBdd
} from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const packedBddString = '1AQECAAMEBgUGBgd+BggJCAoLBQwNCA4PBxARBQwSBxMUBxUWEX5/EBJ+BxcYB4GMBRkaBBscEX6MCx0eBB8gCSEiBCMkCyUmBCcoDykqDysqBSwtBS4tBRkvCTAxCzIzBS40BTU2BTc4BTk6CjuMBX48CYeCCyiMBX49EX4+EX6AEX4/D0B+DxJ+D0F+CkJDBURFBUZHBSxICUlKCktMCk1OCk1PEYGDCjdQClFSClGMEYyDDH5TDH5UDop/DoqMEX5VEX6DD1YqDBpXClhZClhaCltcCltdCl5fBWBhBWJjD2R+DC1lEYGFD2Y3D1A3EYGMEYyFD2eMEH6BEH6MDoyEECtoD2lqEYeIEYeLD2tZEYKGEYJsEYJtD25+DC1vCnBSCnBxCnJzCnKMEBJ0D2RUEYGLEYyLEXV2ECt3ECo3EYdtDouEDouMEBJ4D3lUEYyID3qMEYyGEYxVEYx+Dn6BDop+EYF7EXx7EBJ9EYxtDox+Dn6MEYx7';

let packedBdd: PackedBdd | undefined;
export function getPackedBdd(): PackedBdd {
    if (!packedBdd) {
        packedBdd = packedBddFromBase64String(packedBddString);
    }
    return packedBdd;
}

export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithPackedBdd(
        getPackedBdd(),
        stateResolveFunctionByIndex,
        input
    );
