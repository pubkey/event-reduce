import * as fs from 'fs';
import {
    read as readLastLines
} from 'read-last-lines';

import {
    getNextStateSet,
    binaryToDecimal
} from './binary-state';
import {
    StateSet,
    ActionName,
    StateSetToActionMap
} from '../types';
import { calculateActionForState } from './calculate-action-for-state';

export async function generateLogicMap(
    logicMapFilePath: string,
    startStateSet: StateSet,
    endStateSet: StateSet
) {
    let stateSet: StateSet = startStateSet;
    const totalAmount = binaryToDecimal(endStateSet) - binaryToDecimal(startStateSet);

    if (fs.existsSync(logicMapFilePath)) {
        // file exists continue from there
        const lastLine = await readLastLines(logicMapFilePath, 1);
        console.log('last line of previous calculation: ' + lastLine);
        const split = lastLine.split(':');
        stateSet = split[0];
    }

    const writeStream = fs.createWriteStream(logicMapFilePath, {});

    let done = binaryToDecimal(stateSet) - binaryToDecimal(startStateSet);


    const stateSetToActionMap: StateSetToActionMap = new Map();
    while (stateSet !== endStateSet) {
        const action: ActionName = await calculateActionForState(
            stateSet,
            20,
            stateSetToActionMap
        );

        const keyValue = stateSet + ':' + action;
        console.log(keyValue);
        writeStream.write(keyValue + '\n');

        // add to map so later runs go faster
        stateSetToActionMap.set(stateSet, action);

        done++;
        stateSet = getNextStateSet(stateSet);

        console.log('# processing: ' + done + '/' + totalAmount);
    }

}
