import * as assert from 'assert';
import {
    calculateActionForState
} from '../../src/logic-generator/calculate-action-for-state';
import {
    STATE_SET_LENGTH
} from '../../src/logic-generator/binary-state';
import {
    getStateSet
} from '../../src/states';
import {
    orderedActionList
} from '../../src/actions';
import {
    ActionName, StateSet
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
        assert.ok(orderedActionList.includes(action));
    });
    it('should have the given action insertFirst', async () => {
        const input = getExampleStateResolveFunctionInput();
        const stateSet = getStateSet(input); // 10001000100101011
        const action: ActionName = await calculateActionForState(
            stateSet,
            1
        );
        assert.equal(action, 'insertFirst');
    });
    it('should doNothing on impossible state', async () => {
        const stateSet: StateSet = new Array(STATE_SET_LENGTH)
            .fill('1')
            .join(''); // '111111111...'
        const action: ActionName = await calculateActionForState(
            stateSet,
            1
        );
        assert.equal(action, 'doNothing');
    });
});
