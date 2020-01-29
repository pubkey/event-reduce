import * as assert from 'assert';
import {
    orderedStateList,
    stateResolveFunctions,
    getStateSet
} from '../../src/states';
import { getExampleStateResolveFunctionInput } from '../helper/input';

describe('states.test.ts', () => {
    const input = getExampleStateResolveFunctionInput(); // do not mutate
    describe('basic', () => {
        it('should have the correct amount of states', () => {
            assert.strictEqual(
                orderedStateList.length,
                Object.keys(stateResolveFunctions).length
            );
        });
    });
    describe('getStateSet()', () => {
        it('should have length equal to the amount of states', () => {
            const stateSet = getStateSet(input);
            assert.strictEqual(
                stateSet.length,
                orderedStateList.length
            );
        });
    });
});
