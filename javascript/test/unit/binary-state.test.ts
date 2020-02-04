import * as assert from 'assert';
import {
    FIRST_STATE_SET,
    getNextStateSet,
    decimalToPaddedBinary,
    binaryToDecimal,
    LAST_STATE_SET,
    isStateOperation,
    isStateSetReachable
} from '../../src/logic-generator/binary-state';
import {
    orderedStateList, getStateSet
} from '../../src/states';
import { StateSet, QueryParams, StateResolveFunctionInput } from '../../src/types';
import { getExampleStateResolveFunctionInput } from '../helper/input';
import { DEFAULT_EXAMPLE_QUERY, findAllQuery } from '../../src/logic-generator/queries';
import { getQueryParamsByMongoQuery } from '../../src/logic-generator/minimongo-helper';
import { Human } from '../../src/logic-generator/types';
import { randomHuman } from '../../src/logic-generator/data-generator';

describe('binary-state.test.ts', () => {
    describe('FIRST_STATE_SET', () => {
        it('have the correct initial stateSet', () => {
            assert.strictEqual(
                orderedStateList.length,
                FIRST_STATE_SET.length
            );
            const nonZero = FIRST_STATE_SET.split('').find(c => c !== '0');
            assert.ok(!nonZero);
        });
    });
    describe('LAST_STATE_SET', () => {
        it('have the correct last stateSet', () => {
            assert.strictEqual(
                orderedStateList.length,
                LAST_STATE_SET.length
            );
            const nonOne = LAST_STATE_SET.split('').find(c => c !== '1');
            assert.ok(!nonOne);
        });
    });
    describe('decimalToPaddedBinary()', () => {
        it('should be zero', () => {
            assert.ok(
                decimalToPaddedBinary(0).endsWith('0')
            );
        });
        it('should be seven', () => {
            assert.ok(
                decimalToPaddedBinary(7).endsWith('0111')
            );
        });
    });
    describe('getNextState()', () => {
        it('should get the initial state', () => {
            assert.strictEqual(
                FIRST_STATE_SET,
                getNextStateSet()
            );
        });
        it('should get one', () => {
            assert.strictEqual(
                binaryToDecimal(getNextStateSet(FIRST_STATE_SET)),
                1
            );
        });
        it('all stateSets should have the correct length', () => {
            let lastSet = FIRST_STATE_SET;
            const sets: StateSet[] = new Array(10).fill(0)
                .map(() => {
                    lastSet = getNextStateSet(lastSet);
                    return lastSet;
                });
            sets.forEach(set => {
                assert.strictEqual(
                    set.length,
                    orderedStateList.length
                );
                assert.ok(set.startsWith('0'));
            });
        });
    });
    describe('isStateSetReachable()', () => {
        it('should be an unreachable state', () => {
            const stateSet: StateSet = orderedStateList.map(stateName => {
                if (isStateOperation(stateName)) {
                    return '1';
                } else {
                    return '0';
                }
            }).join('');
            const reachable = isStateSetReachable(stateSet);
            assert.strictEqual(reachable, false);
        });
        it('should be reachable state', () => {
            const doc = randomHuman();
            const input: StateResolveFunctionInput<Human>  = {
                previousResults: [],
                changeEvent: {
                    operation: 'INSERT',
                    doc: doc,
                    id: doc._id,
                    previous: null
                },
                queryParams: getQueryParamsByMongoQuery(findAllQuery)
            };

            const stateSet = getStateSet(input);
            const reachable = isStateSetReachable(stateSet);
            assert.strictEqual(reachable, true);
        });
        it('should be unreacheable if hasLimit && wasLimitReached', () => {
            const stateSet: StateSet = orderedStateList.map(() => '0').join('');
            const reachable = isStateSetReachable(stateSet);
            assert.strictEqual(reachable, false);
        });
    });

});
