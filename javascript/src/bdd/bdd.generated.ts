import {
    PackedBdd,
    packedBddFromBase64String,
    resolveWithPackedBdd
} from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const packedBddString = '1AAECAQMEAwUGAwcIAwkKBQsMBA0OBQ8QBBESBRMUBBUWBhcYBhkaBRscBR0eBh+5BiC5BSEiBSMkBiUYBiYnBSgpBSorDiwYEbm6DiwaEbnJBi0YBi4aBi8YBjAxCDK8CDO8BjS5BjW5Bja5Bje5CDg5CDo7EDG5BjwYBj0nBj4YBj8nD0BBBxdCBxlDDrlEDrkxEbnICUW9CUa9Bx9HByBICLnJCEnICUpLCUxNCU5PCVBRByVSB1NUCFVWCFdYEbnFEbm7DllaDlkxEbm+C7nCC1vCCFzJCF3IDLleCl9gCmFiCmNkEby+CmVmCmFnCmNoCk1pCGprCDpsCG1uCm8vCnDJCnFyCnPID3S5Ebm/DLl1CXbJCXfIELnIC3h5Cxd6Eb3BDnt8EbzAD31NC355C3+ADnuBD4JNEbzICYOECoWGCVCHCYiJCorIDLlEEcm+DLmLDIyNEci+EbnHELm8C7nJC0nIDI4YEcLDEcLGEb3GEb2/EbzGDI6PDJCRDnqSEb3JEbzJCpOUCpWWEcnAD5fJCk2CCpiZCpqbEcjAEDGcDrmdDl6LDUBBEDGeDZ+gDqGPEcLIC6KjC0KkEcnBDsmlEcnGC6anC6ipEcjBDsiqEci5EHQxEby5Dix0DiwxD6usDK1aEcjDDq6vEci/DK2LEcfDDLCxDrKqEcfIEEBpEEFNDXS5D6+zEcjGDbS1DraLD7eqEcjJDll0DlmdD7heEcfGEHSq';

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
