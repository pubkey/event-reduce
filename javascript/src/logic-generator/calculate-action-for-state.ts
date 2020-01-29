import {
    StateSetToActionMap,
    StateSet,
    ActionName
} from '../types';
import {
    orderedActionList,
    actionFunctions
} from '../actions';

import {
    testResults
} from './test-results';
import {
    allQueries
} from './queries';

/**
 * calculates the best action for a given StateSet
 * It does that by itteration over the actions and using testResults()
 * to find if that action fits the 'real' query-results
 */
export async function calculateActionForState(
    stateSet: StateSet,
    // if map is passed, it will be used so this function runs faster
    stateSetToActionMap?: StateSetToActionMap
): Promise<ActionName> {
    const useActionMap: StateSetToActionMap = stateSetToActionMap ? stateSetToActionMap : new Map();

    for (let i = 0; i < orderedActionList.length; i++) {
        const action: ActionName = orderedActionList[i];
        useActionMap.set(stateSet, action);

        const valid = await testResults(
            allQueries,
            100,
            useActionMap
        );
        if (valid.correct) {
            return action;
        }
    }



    return 'runFullQueryAgain';
}