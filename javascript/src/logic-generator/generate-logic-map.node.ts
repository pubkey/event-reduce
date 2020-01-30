import * as path from 'path';
import * as fs from 'fs';
import {
    read as readLastLines
} from 'read-last-lines';

import {
    FIRST_STATE_SET,
    LAST_STATE_SET,
    getNextStateSet
} from './binary-state';
import {
    StateSet,
    ActionName,
    StateSetToActionMap
} from '../types';
import { calculateActionForState } from './calculate-action-for-state';

export const LOGIC_MAP_PATH = path.join(
    __dirname,
    'logic-map.txt'
);

export async function run() {
    let stateSet: StateSet = FIRST_STATE_SET;

    if (fs.existsSync(LOGIC_MAP_PATH)) {
        // file exists continue from there
        const lastLine = await readLastLines(LOGIC_MAP_PATH, 1);
        console.log('last line of previous calculation: ' + lastLine);
        const split = lastLine.split(':');
        stateSet = split[0];
    }


    const stateSetToActionMap: StateSetToActionMap = new Map();
    while (stateSet !== LAST_STATE_SET) {
        console.log('stateSet: ' + stateSet);
        const action: ActionName = await calculateActionForState(
            stateSet,
            20,
            stateSetToActionMap
        );
        if (action !== 'doNothing') {
            console.log('#'.repeat(40));
            console.log('#'.repeat(40));
            console.log('#'.repeat(40));
            console.log('#'.repeat(40));
            console.log('#'.repeat(40));
            console.log('#'.repeat(40));
            console.log('#'.repeat(40));
        }

        const keyValue = stateSet + ':' + action;
        console.log(keyValue);
        fs.appendFileSync(LOGIC_MAP_PATH, keyValue + '\n');

        // add to map so later runs go faster
        stateSetToActionMap.set(stateSet, action);

        stateSet = getNextStateSet(stateSet);
    }

}


run();
