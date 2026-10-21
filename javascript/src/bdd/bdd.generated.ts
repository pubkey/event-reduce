import {
    PackedBdd,
    packedBddFromBase64String,
    resolveWithPackedBdd
} from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const packedBddString = '1AAECAQMEAwUGAwcIAwkKBQsMBA0OBQ8QBBESBRMUBBUWBhcYBhkaBRscBR0eBh+9BiC9BSEiBSMkBiUYBiYnBSgpBSorDiwYEb2+DiwaEb3NBi0YBi4aBi8YBjAaCDHACDLABjO9BjS9BjW9Bja9CDc4CDk6EBq9BjsYBjwnBj0YBj4/D0BBBxdCBxlDDr1EDr0aCUXBCUbBBx9HByBICL3NCEnNCUpLCUxNCU5PCVBRByVSB1NUCFVWCFdYCr0nEb3JEb2/DllaDlkaEb3CC73GC1vGCFzNCF3NDL1eCl9gCmFiCmNkEcDCCmVmCmFnCmNoCk1pCGprCGw6CG1jCm4vCljNCm9wEc3CD3G9Eb3DDL1yCXPNCXTNEL3NC3V2C3d4EcHFDnl6EcDEDntjC3x2C31+Dn+ADoFpEcDNCYKDCoSFCYaHCYjFDL1EDL0nDL2JEb3LEL3AC73NC4rGDIsYEcbHDIwXEcbKD41hEcHDD45NDIuPDEGQDsrND8phEcHND8rCCpGSCpOUEc3EDpWECmWWCmGXCpiZDs2aDL3NDUBBDZsXEcHKEcDKEBqcDp2PC56fC6ChEc3FDqKjD8rNC6SlDn/NDL2mDL2nEM2oDiy9EcC9D6mqDKtaEc3HDKytDq6vD43NEc3DDL2wDrHNEFqcDrKcEc29EEDMEEHCDXG9DbO0DrVaD3i2Ec3KDrePD3jKD8TNDlm9DrhaD7m9EcbND7q7D7y9Eb3FEcDMEL3CEL1x';

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
