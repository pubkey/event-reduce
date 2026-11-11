import * as assert from 'assert';
import { cloneMap } from '../../src/util.js';

describe('clone-map.test.ts', () => {
    it('should copy all entries into a new map', () => {
        const original = new Map<string, number>([['a', 1], ['b', 2]]);
        const cloned = cloneMap(original);
        assert.ok(cloned instanceof Map);
        assert.notStrictEqual(cloned, original);
        assert.deepStrictEqual(Array.from(cloned.entries()), [['a', 1], ['b', 2]]);
    });
    it('should work with keys that are not strings', () => {
        const key = { id: 'a' };
        const cloned = cloneMap(new Map([[key, 1]]));
        assert.strictEqual(cloned.get(key), 1);
    });
    it('should not change the original when the clone is changed', () => {
        const original = new Map<string, number>([['a', 1]]);
        const cloned = cloneMap(original);
        cloned.set('b', 2);
        cloned.delete('a');
        assert.deepStrictEqual(Array.from(original.entries()), [['a', 1]]);
    });
});
