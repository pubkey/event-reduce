import * as assert from 'assert';
import {
    applyChangeEventToResultWindowBuffer,
    calculateActionFromMap,
    calculateActionFunction,
    calculateActionName,
    createResultWindowBuffer,
    resetResultWindowBuffer
} from '../../src/index.js';
import type { ChangeEvent, QueryParams, StateResolveFunctionInput } from '../../src/types/index.js';

/**
 * Document ids must be strings, numbers are not allowed.
 * TypeScript checks that already, these tests are for callers without types.
 */
describe('string-ids.test.ts', () => {
    const queryParams: QueryParams<any> = {
        primaryKey: 'id',
        sortFields: ['age', 'id'],
        limit: 5,
        queryMatcher: () => true,
        sortComparator: (a, b) => a.age !== b.age ? (a.age < b.age ? -1 : 1) : (a.id < b.id ? -1 : 1)
    };
    const expected = { message: 'EventReduce:ID_NOT_STRING' };
    const insert = (id: any): ChangeEvent<any> => ({ operation: 'INSERT', id, doc: { id, age: 1 }, previous: null });

    it('should accept string ids', () => {
        const input: StateResolveFunctionInput<any> = {
            queryParams,
            changeEvent: insert('b'),
            previousResults: [{ id: 'a', age: 1 }]
        };
        assert.strictEqual(calculateActionName(input), 'insertLast');
        // an id that looks like a number is fine, as long as it is a string ('2' sorts before 'a')
        assert.strictEqual(calculateActionName({ ...input, changeEvent: insert('2') }), 'insertFirst');
    });
    it('should throw when the id of the change event is not a string', () => {
        [1, 0, null, undefined, { id: 'a' }].forEach(id => {
            const input: StateResolveFunctionInput<any> = { queryParams, changeEvent: insert(id), previousResults: [] };
            assert.throws(() => calculateActionName(input), expected);
            assert.throws(() => calculateActionFunction(input), expected);
            assert.throws(() => calculateActionFromMap(new Map(), input), expected);
        });
    });
    it('should throw when the id of a document is not a string', () => {
        const input: StateResolveFunctionInput<any> = {
            queryParams,
            changeEvent: insert('b'),
            previousResults: [{ id: 1, age: 1 }]
        };
        assert.throws(() => calculateActionName(input), expected);
        // also with getDocumentId
        const withGetter = { ...queryParams, getDocumentId: (doc: any) => doc.key };
        assert.throws(
            () => calculateActionName({ ...input, queryParams: withGetter, previousResults: [{ key: 1, age: 1 }] }),
            expected
        );
        assert.strictEqual(
            calculateActionName({ ...input, queryParams: withGetter, previousResults: [{ key: 'a', age: 1 }] }),
            'insertLast'
        );
    });
    it('should throw in the result window buffer', () => {
        const resultWindowBuffer = createResultWindowBuffer(queryParams, {});
        assert.throws(() => resetResultWindowBuffer(resultWindowBuffer, [{ id: 1, age: 1 }]), expected);
        resetResultWindowBuffer(resultWindowBuffer, [{ id: 'a', age: 1 }]);
        assert.throws(() => applyChangeEventToResultWindowBuffer(resultWindowBuffer, insert(2)), expected);
        assert.strictEqual(applyChangeEventToResultWindowBuffer(resultWindowBuffer, insert('b')), 'eventReduce');
    });
});
