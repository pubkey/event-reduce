import {
    PackedBdd,
    packedBddFromBase64String,
    resolveWithPackedBdd
} from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const packedBddString = '${packedBddString}';

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
