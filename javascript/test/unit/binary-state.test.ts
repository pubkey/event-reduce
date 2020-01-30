import * as assert from 'assert';
import {
    FIRST_STATE_SET,
    getNextStateSet,
    decimalToBinary,
    binaryToDecimal,
    LAST_STATE_SET
} from '../../src/logic-generator/binary-state';
import {
    orderedStateList
} from '../../src/states';

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
    describe('decimalToBinary()', () => {
        it('should be zero', () => {
            assert.strictEqual(
                '0',
                decimalToBinary(0)
            );
        });
        it('should be seven', () => {
            assert.strictEqual(
                '111',
                decimalToBinary(7)
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

    });

});
