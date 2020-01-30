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

export async function run() {
    let stateSet: StateSet = FIRST_STATE_SET;
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
        console.log(stateSet + ': ' + action);
        stateSetToActionMap.set(stateSet, action);

        stateSet = getNextStateSet(stateSet);
    }

}


run();
