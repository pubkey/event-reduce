import * as assert from 'assert';
import {
    applyChangeEventToResultWindowBuffer,
    calculateActionName,
    createResultWindowBuffer,
    resetResultWindowBuffer,
    runAction
} from '../../src/index.js';
import type { ChangeEvent, QueryParams, StateResolveFunctionInput } from '../../src/types/index.js';

type Doc = { id: string; age: number; };

/**
 * @param breakTies false gives a comparator that returns 0 for two documents with the same age
 */
function getQueryParams(breakTies: boolean, limit?: number): QueryParams<Doc> {
    return {
        primaryKey: 'id',
        sortFields: breakTies ? ['age', 'id'] : ['age'],
        limit,
        queryMatcher: () => true,
        sortComparator: (a, b) => {
            if (a.age !== b.age) {
                return a.age < b.age ? -1 : 1;
            }
            if (!breakTies) {
                return 0 as any;
            }
            return a.id < b.id ? -1 : 1;
        }
    };
}

const a: Doc = { id: 'a', age: 1 };
const b: Doc = { id: 'b', age: 2 };
const c: Doc = { id: 'c', age: 3 };
function insertEvent(doc: Doc): ChangeEvent<Doc> {
    return { operation: 'INSERT', id: doc.id, doc, previous: null };
}
const isCmpZero = (err: Error) => err.message === 'EventReduce:CMP_ZERO';

describe('comparator-zero.test.ts', () => {
    describe('comparator returns 0 for two different documents', () => {
        it('calculateActionName() should throw', () => {
            const input: StateResolveFunctionInput<Doc> = {
                queryParams: getQueryParams(false, 3),
                changeEvent: insertEvent({ id: 'x', age: 3 }),
                previousResults: [a, b, c]
            };
            assert.throws(() => calculateActionName(input), isCmpZero);
        });
        it('runAction() should throw and not change the results', () => {
            const results = [a, b, c];
            assert.throws(
                () => runAction(
                    'insertAtSortPosition',
                    getQueryParams(false),
                    insertEvent({ id: 'x', age: 2 }),
                    results
                ),
                isCmpZero
            );
            assert.deepStrictEqual(results, [a, b, c]);
        });
        it('the result window buffer should throw', () => {
            const buffer = createResultWindowBuffer(getQueryParams(false, 2), { limitBufferSize: 2 });
            resetResultWindowBuffer(buffer, [a, b, c]);
            assert.throws(
                () => applyChangeEventToResultWindowBuffer(buffer, insertEvent({ id: 'x', age: 3 })),
                isCmpZero
            );
        });
    });
    describe('no error', () => {
        it('when the comparator breaks the tie', () => {
            const queryParams = getQueryParams(true, 3);
            const changeEvent = insertEvent({ id: 'x', age: 3 });
            assert.strictEqual(
                calculateActionName({ queryParams, changeEvent, previousResults: [a, b, c] }),
                'doNothing'
            );
            const results = [a, b, c];
            runAction('insertAtSortPosition', getQueryParams(true), insertEvent({ id: 'x', age: 2 }), results);
            assert.deepStrictEqual(results.map(d => d.id), ['a', 'b', 'x', 'c']);

            const buffer = createResultWindowBuffer(getQueryParams(true, 2), { limitBufferSize: 2 });
            resetResultWindowBuffer(buffer, [a, b, c]);
            applyChangeEventToResultWindowBuffer(buffer, changeEvent);
        });
        it('when a comparator without tie-break never sees a tie', () => {
            const input: StateResolveFunctionInput<Doc> = {
                queryParams: getQueryParams(false, 3),
                changeEvent: insertEvent({ id: 'x', age: 0 }),
                previousResults: [a, b, c]
            };
            assert.strictEqual(calculateActionName(input), 'removeLastInsertFirst');
        });
    });
});
