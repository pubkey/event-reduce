import * as assert from 'assert';
import { isObject } from '../../src/util.js';

describe('is-object.test.ts', () => {
    it('should be true for objects, arrays and functions', () => {
        // these calls did not compile when the parameter was typed as null
        assert.strictEqual(isObject({}), true);
        assert.strictEqual(isObject({ a: 1 }), true);
        assert.strictEqual(isObject([]), true);
        assert.strictEqual(isObject(() => 1), true);
        assert.strictEqual(isObject(new Map()), true);
    });
    it('should be false for null and primitive values', () => {
        assert.strictEqual(isObject(null), false);
        assert.strictEqual(isObject(undefined), false);
        assert.strictEqual(isObject('a'), false);
        assert.strictEqual(isObject(1), false);
        assert.strictEqual(isObject(true), false);
    });
    it('should narrow the type of the value', () => {
        const value: unknown = { a: 1 };
        if (isObject(value)) {
            assert.deepStrictEqual(Object.keys(value), ['a']);
        } else {
            assert.fail('value is an object');
        }
    });
});
