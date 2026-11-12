import * as assert from 'assert';
import {
    calculateActionFromMap,
    calculateActionFunction,
    calculateActionName,
    createResultWindowBuffer,
    doNothing,
    runAction
} from '../../src/index.js';
import type { ChangeEvent, QueryParams, StateResolveFunctionInput } from '../../src/types/index.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';
import { randomHuman } from '../../src/truth-table-generator/data-generator.js';

type Doc = { id: string; age: number; };

function getQueryParams(limit: number | undefined, skip?: number): QueryParams<Doc> {
    return {
        primaryKey: 'id',
        sortFields: ['age', 'id'],
        skip,
        limit,
        queryMatcher: () => true,
        sortComparator: (a, b) => a.age !== b.age ? (a.age < b.age ? -1 : 1) : (a.id < b.id ? -1 : 1)
    };
}

const a: Doc = { id: 'a', age: 1 };
const events: ChangeEvent<Doc>[] = [
    { operation: 'INSERT', id: 'a', doc: a, previous: null },
    { operation: 'UPDATE', id: 'a', doc: { id: 'a', age: 2 }, previous: a },
    { operation: 'DELETE', id: 'a', doc: null, previous: a }
];

describe('limit.test.ts', () => {
    describe('limit 0', () => {
        it('should always calculate doNothing, the query returns no documents', () => {
            [undefined, 0, 3].forEach(skip => {
                events.forEach(changeEvent => {
                    const input: StateResolveFunctionInput<Doc> = {
                        queryParams: getQueryParams(0, skip),
                        changeEvent,
                        previousResults: [],
                        keyDocumentMap: new Map()
                    };
                    assert.strictEqual(calculateActionName(input), 'doNothing');
                    assert.strictEqual(calculateActionFunction(input), doNothing);
                    assert.strictEqual(calculateActionFromMap(new Map(), input).action, 'doNothing');

                    const results = runAction('doNothing', input.queryParams, changeEvent, input.previousResults);
                    assert.deepStrictEqual(results, []);
                });
            });
        });
        it('should not change how other limits work', () => {
            const input: StateResolveFunctionInput<Doc> = {
                queryParams: getQueryParams(1),
                changeEvent: events[0],
                previousResults: []
            };
            assert.strictEqual(calculateActionName(input), 'insertFirst');
            assert.strictEqual(calculateActionName({ ...input, queryParams: getQueryParams(undefined) }), 'insertFirst');
        });
        it('the database of the truth-table generator should return no documents', () => {
            const collection = mingoCollectionCreator();
            collection.upsert(randomHuman());
            collection.upsert(randomHuman());
            assert.deepStrictEqual(collection.query({ selector: {}, sort: ['_id'], limit: 0 }), []);
            assert.strictEqual(collection.query({ selector: {}, sort: ['_id'], limit: 1 }).length, 1);
            assert.strictEqual(collection.query({ selector: {}, sort: ['_id'] }).length, 2);
            assert.strictEqual(collection.getQueryParams({ selector: {}, sort: ['_id'], limit: 0 }).limit, 0);
        });
    });
    describe('negative limit', () => {
        it('should throw EventReduce:NEG_LIMIT', () => {
            [-1, -0.5, -Infinity].forEach(limit => {
                const input: StateResolveFunctionInput<Doc> = {
                    queryParams: getQueryParams(limit),
                    changeEvent: events[0],
                    previousResults: []
                };
                const expected = { message: 'EventReduce:NEG_LIMIT' };
                assert.throws(() => calculateActionName(input), expected);
                assert.throws(() => calculateActionFunction(input), expected);
                assert.throws(() => calculateActionFromMap(new Map(), input), expected);
                assert.throws(() => createResultWindowBuffer(input.queryParams, {}), expected);
            });
        });
        it('should not throw when there is no limit', () => {
            [undefined, null].forEach(limit => {
                const input: StateResolveFunctionInput<Doc> = {
                    queryParams: getQueryParams(limit as any),
                    changeEvent: events[0],
                    previousResults: []
                };
                assert.strictEqual(calculateActionName(input), 'insertFirst');
                createResultWindowBuffer(input.queryParams, {});
            });
        });
    });
});
