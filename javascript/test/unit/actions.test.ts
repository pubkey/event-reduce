import * as assert from 'assert';
import {
    orderedActionList,
    actionFunctions
} from '../../src/actions';

describe('actions.test.ts', () => {
    it('should have the correct amount of actions', () => {
        assert.strictEqual(
            orderedActionList.length,
            Object.keys(actionFunctions).length
        );
    });
})