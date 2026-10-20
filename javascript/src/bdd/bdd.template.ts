import {
    PackedBdd,
    packedBddFromBase64String,
    resolveWithPackedBdd
} from 'binary-decision-diagram';
import type { InternalInput, StateResolveFunctionInput } from '../types/index.js';
import { internalStateResolvers } from '../states/index.js';
import { toInternalInput } from '../util.js';

export const packedBddString = '${packedBddString}';

let packedBdd: PackedBdd | undefined;
export function getPackedBdd(): PackedBdd {
    if (!packedBdd) {
        packedBdd = packedBddFromBase64String(packedBddString);
    }
    return packedBdd;
}

export const resolveInternalInput = (input: InternalInput<any>) => resolveWithPackedBdd(
        getPackedBdd(),
        internalStateResolvers,
        input
    );

export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveInternalInput(
        toInternalInput(input)
    );
