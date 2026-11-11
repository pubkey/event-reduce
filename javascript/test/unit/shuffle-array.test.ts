import * as assert from 'assert';
import { shuffleArray } from '../../src/util.js';

describe('shuffle-array.test.ts', () => {
    it('should return a new array with the same items', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const shuffled = shuffleArray(input);
        assert.notStrictEqual(shuffled, input);
        assert.deepStrictEqual(input, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        assert.deepStrictEqual(shuffled.slice().sort((a, b) => a - b), input);
    });
    it('should work with empty arrays and arrays with one item', () => {
        assert.deepStrictEqual(shuffleArray([]), []);
        assert.deepStrictEqual(shuffleArray(['a']), ['a']);
    });
    it('should return each order equally often', () => {
        const runs = 12000;
        const counts = new Map<string, number>();
        for (let i = 0; i < runs; i++) {
            const order = shuffleArray(['a', 'b', 'c']).join('');
            counts.set(order, (counts.get(order) || 0) + 1);
        }
        assert.strictEqual(counts.size, 6);
        /**
         * Each of the 6 orders is expected 2000 times with a standard deviation of about 41,
         * so a correct shuffle practically never leaves this range.
         */
        counts.forEach((count, order) => {
            assert.ok(count > 1700 && count < 2300, order + ' was returned ' + count + ' times');
        });
    });
});
