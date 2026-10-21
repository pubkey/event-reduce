import {
    PackedBdd,
    packedBddFromBase64String,
    resolveWithPackedBdd
} from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const packedBddString = '1AQECAAMEEQUGBgdcEVwIBglcBgoLCwwNBg4PCxANCxESBV0TBVwUBxVsBRYXBV1sBVwYBRYZBRobEGxcDFwcCB1fBx4fByAhCiIUCiMkCiUmCiUnBygpCWVgDypeDytcDyxeDy1cBy4vBzAxDBcyCDM0BzU2Bzc4EFxfEFxsDmhdBDlhDmhsBDpsDztcDzxcDz1eDz5cBz9ACWZkCWNhCEFCCENECEVGCEdIDmpiDmpsDlwoBEkpDmgTBEoTD0tMD00pCWlOCU9hCVBRCVJsCVNUCVVsD1ZsCUdsDlwpDmoTDlcTEF5hBFgTD1lkD1phD2lsD1lsD1psD1ZpD1ZkD1ZhDmlsEGhrDlsTDmliDmljEGpr';

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
