import * as assert from 'assert';
import {
    applyChangeEventsToResultWindowBuffer,
    applyChangeEventToResultWindowBuffer,
    calculateActionName,
    createResultWindowBuffer,
    getRecommendedResultWindowBufferSize,
    getResultWindowBufferQuery,
    getResultWindowBufferResults,
    resetResultWindowBuffer,
    runAction
} from '../../src/index.js';
import type { ResultWindowBuffer, ResultWindowBufferResult, ResultWindowBufferSizes } from '../../src/index.js';
import type { ChangeEvent, QueryParams } from '../../src/types/index.js';

/**
 * Randomized test of the result window buffer against a full query.
 * After every event, the visible result must equal the full query,
 * and the buffer must be an exact slice of the full result.
 */

type Doc = {
    _id: string;
    gender: 'm' | 'f';
    age: number;
};

type TestQuery = {
    sortDirection: 'asc' | 'desc';
    skip?: number;
    limit?: number;
};

/**
 * Seeded random number generator (mulberry32),
 * so that every run produces the same events.
 */
function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * The query is always: gender === 'f', sorted by age, then by _id.
 * Age has only 100 different values, so many rows have the same age
 * and the _id decides their order.
 */
function getQueryParams(query: TestQuery): QueryParams<Doc> {
    const direction = query.sortDirection === 'asc' ? 1 : -1;
    return {
        primaryKey: '_id',
        sortFields: ['age', '_id'],
        skip: query.skip,
        limit: query.limit,
        queryMatcher: (doc: Doc) => doc.gender === 'f',
        sortComparator: (a: Doc, b: Doc) => {
            if (a.age !== b.age) {
                return (a.age < b.age ? -direction : direction) as 1 | -1;
            }
            return (a._id < b._id ? -direction : direction) as 1 | -1;
        }
    };
}

/**
 * Full query over all documents: filter, sort, skip, limit.
 */
function runQuery(docs: Map<string, Doc>, queryParams: QueryParams<Doc>, skip: number, limit: number | undefined): Doc[] {
    return Array.from(docs.values())
        .filter(queryParams.queryMatcher)
        .sort(queryParams.sortComparator)
        .slice(skip, limit === undefined ? undefined : skip + limit);
}

function fillResultWindowBuffer(resultWindowBuffer: ResultWindowBuffer<Doc>, docs: Map<string, Doc>) {
    const { skip, limit } = getResultWindowBufferQuery(resultWindowBuffer, {});
    resetResultWindowBuffer(resultWindowBuffer, runQuery(docs, resultWindowBuffer.queryParams, skip, limit));
}

function randomChangeEvent(
    docs: Map<string, Doc>,
    random: () => number,
    newId: () => string,
    weights: { insert: number; update: number; delete: number; }
): ChangeEvent<Doc> {
    const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
    const total = weights.insert + weights.update + weights.delete;
    let r = random() * total;
    if (docs.size === 0 || r < weights.insert) {
        const doc: Doc = { _id: newId(), gender: random() < 0.5 ? 'f' : 'm', age: int(1, 100) };
        return { operation: 'INSERT', id: doc._id, doc, previous: null };
    }
    r = r - weights.insert;
    const allDocs = Array.from(docs.values());
    const previous = allDocs[int(0, allDocs.length - 1)];
    if (r < weights.update) {
        const doc: Doc = { ...previous };
        if (random() < 0.5) {
            // starts or stops matching
            doc.gender = doc.gender === 'f' ? 'm' : 'f';
        } else {
            // moves in the sort order
            doc.age = int(1, 100);
        }
        return { operation: 'UPDATE', id: doc._id, doc, previous };
    }
    return { operation: 'DELETE', id: previous._id, doc: null, previous };
}

const ids = (docs: Doc[]) => docs.map(d => d._id).join(',');
const doc = (_id: string, age: number): Doc => ({ _id, gender: 'f', age });

const QUERIES: TestQuery[] = [
    { sortDirection: 'asc', limit: 20 },
    { sortDirection: 'desc', limit: 20 },
    { sortDirection: 'asc', skip: 10, limit: 20 },
    { sortDirection: 'desc', skip: 10, limit: 20 },
    { sortDirection: 'asc', limit: 1 },
    { sortDirection: 'desc', skip: 3, limit: 5 },
    // skip without limit
    { sortDirection: 'asc', skip: 10 },
    { sortDirection: 'desc', skip: 2 },
    // neither skip nor limit
    { sortDirection: 'asc' }
];
const BUFFER_SIZES: ResultWindowBufferSizes[] = [
    { limitBufferSize: 0, skipBufferSize: 0 },
    { limitBufferSize: 5, skipBufferSize: 0 },
    { limitBufferSize: 0, skipBufferSize: 5 },
    { limitBufferSize: 20, skipBufferSize: 3 },
    { limitBufferSize: 50, skipBufferSize: 20 },
    { limitBufferSize: Infinity, skipBufferSize: Infinity }
];
const INITIAL_ROWS = [0, 30, 300];
const EVENTS_PER_RUN = 600;

/**
 * First more inserts, then mostly updates, then more deletes,
 * so that the result grows, moves around and shrinks to (almost) nothing.
 */
function getWeights(eventIndex: number) {
    const phase = eventIndex / EVENTS_PER_RUN;
    if (phase < 0.4) {
        return { insert: 3, update: 5, delete: 1 };
    } else if (phase < 0.7) {
        return { insert: 1, update: 8, delete: 1 };
    } else {
        return { insert: 1, update: 3, delete: 5 };
    }
}

describe('result-window-buffer.test.ts', () => {
    describe('getRecommendedResultWindowBufferSize()', () => {
        it('should return the recommended size for each limit', () => {
            const expected: [number | undefined, number][] = [
                [undefined, 0], [0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [10, 3], [20, 4],
                [100, 7], [200, 11], [500, 20], [1000, 26], [2711, 29], [2712, 30], [100000, 30]
            ];
            expected.forEach(([limit, size]) => {
                assert.strictEqual(getRecommendedResultWindowBufferSize(limit), size, 'limit ' + limit);
            });
        });
    });
    describe('getResultWindowBufferQuery()', () => {
        it('should add the buffer sizes to the skip and limit', () => {
            const resultWindowBuffer = createResultWindowBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 10, limit: 20 }),
                { limitBufferSize: 5, skipBufferSize: 3 }
            );
            assert.deepStrictEqual(getResultWindowBufferQuery(resultWindowBuffer, {}), { skip: 7, limit: 28 });
        });
        it('should not go below skip 0', () => {
            const resultWindowBuffer = createResultWindowBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 2, limit: 20 }),
                { skipBufferSize: 5 }
            );
            assert.deepStrictEqual(getResultWindowBufferQuery(resultWindowBuffer, {}), { skip: 0, limit: 22 });
        });
        it('should use whole numbers as buffer sizes', () => {
            const query = (size: number) => getResultWindowBufferQuery(createResultWindowBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 10, limit: 20 }),
                { limitBufferSize: size, skipBufferSize: size }
            ), {});
            assert.deepStrictEqual(query(2.5), { skip: 8, limit: 24 });
            assert.deepStrictEqual(query(0), { skip: 10, limit: 20 });
            // Infinity keeps all rows
            assert.deepStrictEqual(query(Infinity), { skip: 0 });
        });
        it('should throw on negative buffer sizes and values that are not numbers', () => {
            const queryParams = getQueryParams({ sortDirection: 'asc', skip: 10, limit: 20 });
            [-1, -0.5, -Infinity, NaN, '5', null, {}, true].forEach(size => {
                assert.throws(() => createResultWindowBuffer(queryParams, { limitBufferSize: size as any }), /RWB_SIZE/, String(size));
                assert.throws(() => createResultWindowBuffer(queryParams, { skipBufferSize: size as any }), /RWB_SIZE/, String(size));
            });
            // not set means 0
            assert.deepStrictEqual(getResultWindowBufferQuery(createResultWindowBuffer(queryParams, {}), {}), { skip: 10, limit: 20 });
        });
        it('should have no limit for a query without a limit', () => {
            const resultWindowBuffer = createResultWindowBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 10 }),
                { limitBufferSize: 5, skipBufferSize: 3 }
            );
            assert.deepStrictEqual(getResultWindowBufferQuery(resultWindowBuffer, {}), { skip: 7 });
        });
        it('should keep the other fields of the query and not change it', () => {
            const resultWindowBuffer = createResultWindowBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 10, limit: 20 }),
                { limitBufferSize: 5, skipBufferSize: 3 }
            );
            const query = { selector: { gender: 'm' }, sort: [{ age: 'asc' }], skip: 10, limit: 20 };
            assert.deepStrictEqual(
                getResultWindowBufferQuery(resultWindowBuffer, query),
                { selector: { gender: 'm' }, sort: [{ age: 'asc' }], skip: 7, limit: 28 }
            );
            assert.deepStrictEqual(query, { selector: { gender: 'm' }, sort: [{ age: 'asc' }], skip: 10, limit: 20 });
        });
        it('should remove the limit of the query when all rows after the skip are needed', () => {
            const resultWindowBuffer = createResultWindowBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 10, limit: 20 }),
                { limitBufferSize: Infinity }
            );
            assert.deepStrictEqual(getResultWindowBufferQuery(resultWindowBuffer, { skip: 10, limit: 20 }), { skip: 10 });
        });
    });
    describe('resetResultWindowBuffer()', () => {
        it('should ask for a full query before it got rows', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), {});
            const result = applyChangeEventToResultWindowBuffer<Doc>(resultWindowBuffer, {
                operation: 'INSERT', id: 'a', doc: doc('a', 1), previous: null
            });
            assert.strictEqual(result, 'runFullQueryAgain');
        });
        it('should throw when the results are read before the buffer got rows', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), {});
            assert.throws(() => getResultWindowBufferResults(resultWindowBuffer), /RWB_OUTDATED/);
        });
        it('should be complete when the query returned fewer rows than requested', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), { limitBufferSize: 2 });
            const rows = [doc('a', 1), doc('b', 2), doc('c', 3)];
            resetResultWindowBuffer(resultWindowBuffer, rows);
            assert.strictEqual(resultWindowBuffer.complete, true);
            assert.deepStrictEqual(getResultWindowBufferResults(resultWindowBuffer), rows.slice(0, 2));
        });
        it('should not be complete when the query returned as many rows as requested', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 1 }), { limitBufferSize: 1 });
            resetResultWindowBuffer(resultWindowBuffer, [doc('a', 1), doc('b', 2)]);
            assert.strictEqual(resultWindowBuffer.complete, false);
        });
        it('should show the rows after the skipped rows of the buffer', () => {
            const resultWindowBuffer = createResultWindowBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 1, limit: 2 }),
                { skipBufferSize: 1 }
            );
            resetResultWindowBuffer(resultWindowBuffer, [doc('a', 1), doc('b', 2), doc('c', 3)]);
            assert.strictEqual(resultWindowBuffer.offset, 0);
            assert.strictEqual(ids(getResultWindowBufferResults(resultWindowBuffer)), 'b,c');
        });
    });
    describe('applyChangeEventToResultWindowBuffer()', () => {
        it('should refill the window from the buffer when a visible row is deleted', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), { limitBufferSize: 2 });
            const rows = [doc('a', 1), doc('b', 2), doc('c', 3), doc('d', 4)];
            resetResultWindowBuffer(resultWindowBuffer, rows);
            const result = applyChangeEventToResultWindowBuffer<Doc>(resultWindowBuffer, {
                operation: 'DELETE', id: 'a', doc: null, previous: rows[0]
            });
            assert.strictEqual(result, 'buffer');
            assert.strictEqual(ids(getResultWindowBufferResults(resultWindowBuffer)), 'b,c');
            assert.strictEqual(ids(resultWindowBuffer.buffer), 'b,c,d');
        });
        it('should not append a row that moves behind the last row of the buffer', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), { limitBufferSize: 1 });
            const rows = [doc('a', 1), doc('b', 2), doc('c', 3)];
            resetResultWindowBuffer(resultWindowBuffer, rows);
            const result = applyChangeEventToResultWindowBuffer<Doc>(resultWindowBuffer, {
                operation: 'UPDATE', id: 'a', doc: doc('a', 99), previous: rows[0]
            });
            assert.strictEqual(result, 'buffer');
            assert.strictEqual(ids(resultWindowBuffer.buffer), 'b,c');
        });
        it('should ask for a full query when a row is added in front of the skip window without a skip buffer', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', skip: 1, limit: 1 }), { limitBufferSize: 1 });
            resetResultWindowBuffer(resultWindowBuffer, [doc('b', 2), doc('c', 3)]);
            const result = applyChangeEventToResultWindowBuffer<Doc>(resultWindowBuffer, {
                operation: 'INSERT', id: 'x', doc: doc('x', 0), previous: null
            });
            assert.strictEqual(result, 'runFullQueryAgain');
        });
        it('should throw when the results are read after runFullQueryAgain without running the query again', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', skip: 1, limit: 1 }), { limitBufferSize: 1 });
            resetResultWindowBuffer(resultWindowBuffer, [doc('b', 2), doc('c', 3)]);
            const result = applyChangeEventToResultWindowBuffer<Doc>(resultWindowBuffer, {
                operation: 'INSERT', id: 'x', doc: doc('x', 0), previous: null
            });
            assert.strictEqual(result, 'runFullQueryAgain');
            assert.throws(() => getResultWindowBufferResults(resultWindowBuffer), /RWB_OUTDATED/);
        });
        it('should take the row from the skip buffer when a row is added in front of the window', () => {
            const resultWindowBuffer = createResultWindowBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 2, limit: 1 }),
                { skipBufferSize: 1 }
            );
            // skip 1, limit 2: 'a' is skipped and not in the buffer
            resetResultWindowBuffer(resultWindowBuffer, [doc('b', 2), doc('c', 3)]);
            assert.strictEqual(ids(getResultWindowBufferResults(resultWindowBuffer)), 'c');
            const result = applyChangeEventToResultWindowBuffer<Doc>(resultWindowBuffer, {
                operation: 'INSERT', id: 'x', doc: doc('x', 0), previous: null
            });
            assert.strictEqual(result, 'buffer');
            assert.strictEqual(resultWindowBuffer.offset, 2);
            assert.strictEqual(ids(getResultWindowBufferResults(resultWindowBuffer)), 'b');
        });
        it('should return no rows for a query with limit 0', () => {
            const random = seededRandom(77);
            let idCounter = 0;
            const newId = () => 'id-' + (idCounter++);
            for (const skip of [0, 2]) {
                const docs = new Map<string, Doc>();
                for (let i = 0; i < 10; i++) {
                    const changeEvent = randomChangeEvent(docs, random, newId, { insert: 1, update: 0, delete: 0 });
                    docs.set(changeEvent.id, changeEvent.doc as Doc);
                }
                const queryParams = getQueryParams({ sortDirection: 'asc', skip, limit: 0 });
                const resultWindowBuffer = createResultWindowBuffer(queryParams, { limitBufferSize: 2, skipBufferSize: 2 });
                fillResultWindowBuffer(resultWindowBuffer, docs);
                assert.strictEqual(getResultWindowBufferQuery(resultWindowBuffer, {}).limit, skip + 2);
                assert.deepStrictEqual(getResultWindowBufferResults(resultWindowBuffer), []);
                for (let i = 0; i < 100; i++) {
                    const changeEvent = randomChangeEvent(docs, random, newId, getWeights(i));
                    if (changeEvent.operation === 'DELETE') {
                        docs.delete(changeEvent.id);
                    } else {
                        docs.set(changeEvent.id, changeEvent.doc);
                    }
                    if (applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent) === 'runFullQueryAgain') {
                        fillResultWindowBuffer(resultWindowBuffer, docs);
                    }
                    assert.deepStrictEqual(getResultWindowBufferResults(resultWindowBuffer), []);
                    assert.ok(resultWindowBuffer.buffer.length <= 4);
                }
            }
        });
        it('should handle a query with a skip but without a limit', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', skip: 1 }), { skipBufferSize: 1 });
            const rows = [doc('a', 1), doc('b', 2), doc('c', 3)];
            resetResultWindowBuffer(resultWindowBuffer, rows);
            assert.strictEqual(ids(getResultWindowBufferResults(resultWindowBuffer)), 'b,c');
            const result = applyChangeEventToResultWindowBuffer<Doc>(resultWindowBuffer, {
                operation: 'INSERT', id: 'x', doc: doc('x', 0), previous: null
            });
            assert.notStrictEqual(result, 'runFullQueryAgain');
            assert.strictEqual(ids(getResultWindowBufferResults(resultWindowBuffer)), 'a,b,c');
        });
    });
    describe('applyChangeEventsToResultWindowBuffer()', () => {
        it('should return the new results and if they changed', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), { limitBufferSize: 3 });
            resetResultWindowBuffer(resultWindowBuffer, [doc('a', 1), doc('b', 2), doc('c', 3), doc('d', 4), doc('e', 5)]);
            // a row after the result window changes
            const notVisible = applyChangeEventsToResultWindowBuffer<Doc>(resultWindowBuffer, [
                { operation: 'UPDATE', id: 'e', doc: doc('e', 6), previous: doc('e', 5) }
            ]);
            assert.ok(!notVisible.runFullQueryAgain && !notVisible.changed);

            const visible = applyChangeEventsToResultWindowBuffer<Doc>(resultWindowBuffer, [
                { operation: 'DELETE', id: 'a', doc: null, previous: doc('a', 1) },
                { operation: 'DELETE', id: 'b', doc: null, previous: doc('b', 2) }
            ]);
            assert.ok(!visible.runFullQueryAgain && visible.changed);
            assert.strictEqual(ids(visible.runFullQueryAgain ? [] : visible.results), 'c,d');
        });
        it('should report a changed row at the same position as changed', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), {});
            resetResultWindowBuffer(resultWindowBuffer, [doc('a', 1), doc('b', 3)]);
            const result = applyChangeEventsToResultWindowBuffer<Doc>(resultWindowBuffer, [
                { operation: 'UPDATE', id: 'a', doc: doc('a', 2), previous: doc('a', 1) }
            ]);
            assert.ok(!result.runFullQueryAgain && result.changed);
        });
        it('should ask for a full query when the result window does not fit into the buffer', () => {
            const resultWindowBuffer = createResultWindowBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), {});
            const empty = applyChangeEventsToResultWindowBuffer<Doc>(resultWindowBuffer, []);
            assert.strictEqual(empty.runFullQueryAgain, true);

            resetResultWindowBuffer(resultWindowBuffer, [doc('a', 1), doc('b', 2)]);
            const result = applyChangeEventsToResultWindowBuffer<Doc>(resultWindowBuffer, [
                { operation: 'DELETE', id: 'a', doc: null, previous: doc('a', 1) }
            ]);
            assert.strictEqual(result.runFullQueryAgain, true);
        });
        it('should return the same as a full query for random batches of events', () => {
            const random = seededRandom(4242);
            let idCounter = 0;
            const newId = () => 'id-' + (idCounter++);
            for (const query of QUERIES) {
                const docs = new Map<string, Doc>();
                for (let i = 0; i < 30; i++) {
                    const changeEvent = randomChangeEvent(docs, random, newId, { insert: 1, update: 0, delete: 0 });
                    docs.set(changeEvent.id, changeEvent.doc as Doc);
                }
                const queryParams = getQueryParams(query);
                const skip = query.skip ? query.skip : 0;
                const resultWindowBuffer = createResultWindowBuffer(queryParams, { limitBufferSize: 3, skipBufferSize: 3 });
                fillResultWindowBuffer(resultWindowBuffer, docs);
                let previousResults = runQuery(docs, queryParams, skip, query.limit);
                for (let batch = 0; batch < 100; batch++) {
                    const changeEvents: ChangeEvent<Doc>[] = [];
                    const batchSize = 1 + Math.floor(random() * 5);
                    for (let i = 0; i < batchSize; i++) {
                        const changeEvent = randomChangeEvent(docs, random, newId, getWeights(batch * 5 + i));
                        changeEvents.push(changeEvent);
                        if (changeEvent.operation === 'DELETE') {
                            docs.delete(changeEvent.id);
                        } else {
                            docs.set(changeEvent.id, changeEvent.doc);
                        }
                    }
                    const result = applyChangeEventsToResultWindowBuffer(resultWindowBuffer, changeEvents);
                    const expected = runQuery(docs, queryParams, skip, query.limit);
                    if (result.runFullQueryAgain) {
                        fillResultWindowBuffer(resultWindowBuffer, docs);
                    } else {
                        assert.strictEqual(ids(result.results), ids(expected));
                        const expectedChanged = expected.length !== previousResults.length ||
                            expected.some((d, i) => d !== previousResults[i]);
                        assert.strictEqual(result.changed, expectedChanged);
                    }
                    previousResults = expected;
                }
            }
        });
    });
    describe('a buffer with both sizes 0', () => {
        it('should never run the full query when EventReduce alone does not', () => {
            let eventReduceFullQueries = 0;
            let bufferFullQueries = 0;
            let seed = 1000;
            for (const query of QUERIES) {
                for (const initialRows of INITIAL_ROWS) {
                    seed++;
                    const random = seededRandom(seed);
                    let idCounter = 0;
                    const newId = () => 'id-' + (idCounter++);
                    const docs = new Map<string, Doc>();
                    for (let i = 0; i < initialRows; i++) {
                        const changeEvent = randomChangeEvent(docs, random, newId, { insert: 1, update: 0, delete: 0 });
                        docs.set(changeEvent.id, changeEvent.doc as Doc);
                    }
                    const queryParams = getQueryParams(query);
                    const skip = query.skip ? query.skip : 0;
                    let previousResults = runQuery(docs, queryParams, skip, query.limit);
                    let keyDocumentMap = new Map(previousResults.map(d => [d._id, d]));
                    const resultWindowBuffer = createResultWindowBuffer(queryParams, { limitBufferSize: 0, skipBufferSize: 0 });
                    fillResultWindowBuffer(resultWindowBuffer, docs);

                    for (let i = 0; i < EVENTS_PER_RUN; i++) {
                        const changeEvent = randomChangeEvent(docs, random, newId, getWeights(i));
                        if (changeEvent.operation === 'DELETE') {
                            docs.delete(changeEvent.id);
                        } else {
                            docs.set(changeEvent.id, changeEvent.doc);
                        }

                        const actionName = calculateActionName({ queryParams, changeEvent, previousResults, keyDocumentMap });
                        const eventReduceNeedsQuery = actionName === 'runFullQueryAgain';
                        if (eventReduceNeedsQuery) {
                            eventReduceFullQueries++;
                            previousResults = runQuery(docs, queryParams, skip, query.limit);
                            keyDocumentMap = new Map(previousResults.map(d => [d._id, d]));
                        } else {
                            runAction(actionName, queryParams, changeEvent, previousResults, keyDocumentMap);
                        }

                        const bufferNeedsQuery = applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent) === 'runFullQueryAgain';
                        if (bufferNeedsQuery) {
                            bufferFullQueries++;
                            fillResultWindowBuffer(resultWindowBuffer, docs);
                        }
                        assert.ok(
                            !bufferNeedsQuery || eventReduceNeedsQuery,
                            'buffer needs a full query but EventReduce does not at event #' + i + ' (' + changeEvent.operation + ')'
                        );
                        assert.strictEqual(
                            ids(getResultWindowBufferResults(resultWindowBuffer)),
                            ids(runQuery(docs, queryParams, skip, query.limit))
                        );
                    }
                }
            }
            assert.ok(bufferFullQueries <= eventReduceFullQueries, bufferFullQueries + ' > ' + eventReduceFullQueries);
        });
    });
    describe('randomized against a full query', () => {
        const totalCounts: { [k in ResultWindowBufferResult]: number } = {
            eventReduce: 0,
            buffer: 0,
            runFullQueryAgain: 0
        };

        let seed = 0;
        for (const query of QUERIES) {
            for (const sizes of BUFFER_SIZES) {
                for (const initialRows of INITIAL_ROWS) {
                    seed++;
                    const runSeed = seed;
                    it(
                        'sort ' + query.sortDirection + ', skip ' + query.skip + ', limit ' + query.limit +
                        ', limitBufferSize ' + sizes.limitBufferSize + ', skipBufferSize ' + sizes.skipBufferSize +
                        ', ' + initialRows + ' initial rows',
                        () => {
                            const random = seededRandom(runSeed);
                            let idCounter = 0;
                            const newId = () => {
                                idCounter++;
                                return Math.floor(random() * 1e9).toString(36) + '-' + idCounter;
                            };
                            const docs = new Map<string, Doc>();
                            const applyToDocs = (changeEvent: ChangeEvent<Doc>) => {
                                if (changeEvent.operation === 'DELETE') {
                                    docs.delete(changeEvent.id);
                                } else {
                                    docs.set(changeEvent.id, changeEvent.doc);
                                }
                            };
                            for (let i = 0; i < initialRows; i++) {
                                applyToDocs(randomChangeEvent(docs, random, newId, { insert: 1, update: 0, delete: 0 }));
                            }
                            const queryParams = getQueryParams(query);
                            const skip = query.skip ? query.skip : 0;
                            const resultWindowBuffer = createResultWindowBuffer(queryParams, sizes);
                            fillResultWindowBuffer(resultWindowBuffer, docs);

                            for (let i = 0; i < EVENTS_PER_RUN; i++) {
                                const changeEvent = randomChangeEvent(docs, random, newId, getWeights(i));
                                applyToDocs(changeEvent);

                                const result = applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent);
                                totalCounts[result]++;
                                if (result === 'runFullQueryAgain') {
                                    fillResultWindowBuffer(resultWindowBuffer, docs);
                                }

                                const context = 'event #' + i + ' (' + changeEvent.operation + ', ' + result + ')';

                                // the visible result equals the full query
                                assert.strictEqual(
                                    ids(getResultWindowBufferResults(resultWindowBuffer)),
                                    ids(runQuery(docs, queryParams, skip, query.limit)),
                                    'visible result differs from full query at ' + context
                                );

                                // the buffer is an exact slice of the full result
                                const fullResult = runQuery(docs, queryParams, 0, undefined);
                                if (resultWindowBuffer.buffer.length > 0) {
                                    assert.strictEqual(
                                        ids(resultWindowBuffer.buffer),
                                        ids(fullResult.slice(resultWindowBuffer.offset, resultWindowBuffer.offset + resultWindowBuffer.buffer.length)),
                                        'buffer is not an exact slice of the full result at ' + context
                                    );
                                } else {
                                    // an empty buffer only knows an upper bound of the rows before it
                                    assert.ok(resultWindowBuffer.complete, 'empty buffer must be complete at ' + context);
                                    assert.ok(fullResult.length <= resultWindowBuffer.offset, 'offset is no upper bound at ' + context);
                                }
                                if (resultWindowBuffer.complete) {
                                    assert.ok(
                                        resultWindowBuffer.offset + resultWindowBuffer.buffer.length >= fullResult.length,
                                        'complete buffer misses rows at ' + context
                                    );
                                }

                                // the buffer keeps no more rows than requested on both sides
                                assert.ok(skip - resultWindowBuffer.offset <= (sizes.skipBufferSize || 0), 'too many rows before the window');
                                if (query.limit) {
                                    assert.ok(
                                        resultWindowBuffer.buffer.length <=
                                        Math.max(0, skip - resultWindowBuffer.offset) + query.limit + (sizes.limitBufferSize || 0),
                                        'too many rows after the window'
                                    );
                                }

                                // the key map matches the buffer
                                assert.strictEqual(resultWindowBuffer.keyDocumentMap.size, resultWindowBuffer.buffer.length);
                                resultWindowBuffer.buffer.forEach(d => assert.strictEqual(resultWindowBuffer.keyDocumentMap.get(d._id), d));
                            }
                        }
                    );
                }
            }
        }

        it('has used all three paths', () => {
            assert.ok(totalCounts.eventReduce > 0, JSON.stringify(totalCounts));
            assert.ok(totalCounts.buffer > 0, JSON.stringify(totalCounts));
            assert.ok(totalCounts.runFullQueryAgain > 0, JSON.stringify(totalCounts));
        });
    });
});
