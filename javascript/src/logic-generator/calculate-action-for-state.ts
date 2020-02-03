import {
    StateSetToActionMap,
    StateSet,
    ActionName
} from '../types';
import {
    orderedActionList
} from '../actions';
import {
    testResults
} from './test-results';
import {
    getQueryVariations
} from './queries';
import { isStateSetReachable } from './binary-state';
import { MongoQuery } from './types';
import { getTestProcedures } from './test-procedures';

/**
 * calculates the best action for a given StateSet
 * It does that by itteration over the actions and using testResults()
 * to find if that action fits the 'real' query-results
 */
export async function calculateActionForState(
    stateSet: StateSet,
    // if map is passed, it will be used so this function runs faster
    stateSetToActionMap: StateSetToActionMap = new Map(),
    queries: MongoQuery[] = getQueryVariations(),
    showLogs: boolean = false
): Promise<ActionName> {
    if (!isStateSetReachable(stateSet)) {
        return 'doNothing';
    }
    const prods = await getTestProcedures();
    for (let i = 0; i < orderedActionList.length; i++) {
        const action: ActionName = orderedActionList[i];
        stateSetToActionMap.set(stateSet, action);

        let broken = false;
        for (let t = 0; t < prods.length; t++) {
            const useChangeEvents = prods[t];
            const valid = await testResults(
                queries,
                stateSetToActionMap,
                useChangeEvents,
                showLogs
            );
            if (!valid.correct) {
                broken = true;
                break;
            }
        }
        if (!broken) {
            return action;
        }
    }

    throw new Error('this should not happen');
}
