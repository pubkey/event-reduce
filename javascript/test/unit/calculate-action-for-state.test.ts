import * as assert from 'assert';
import {
    calculateActionForState
} from '../../src/logic-generator/calculate-action-for-state';
import {
    getStateSet
} from '../../src/states';
import {
    orderedActionList
} from '../../src/actions';
import {
    ActionName
} from '../../src/types';
import {
    getExampleStateResolveFunctionInput
} from '../helper/input';
describe('calculate-action-for-state.test.ts', () => {
    it('should not throw and return an action', async () => {
        const input = getExampleStateResolveFunctionInput();
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet
        );

        console.log('action: ' + action);

        assert.ok(orderedActionList.includes(action));
    });
});