import * as assert from 'assert';
import {
    applyChangeEventToLimitBuffer,
    createLimitBuffer,
    getLimitBufferQuery,
    getLimitBufferResults,
    resetLimitBuffer
} from '../../src/index.js';
import type { LimitBuffer, LimitBufferResult, LimitBufferSizes } from '../../src/index.js';
import type { ChangeEvent, QueryParams } from '../../src/types/index.js';

/**
 * Randomized test of the limit buffer against a full query.
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

function fillLimitBuffer(limitBuffer: LimitBuffer<Doc>, docs: Map<string, Doc>) {
    const { skip, limit } = getLimitBufferQuery(limitBuffer);
    resetLimitBuffer(limitBuffer, runQuery(docs, limitBuffer.queryParams, skip, limit));
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
const BUFFER_SIZES: LimitBufferSizes[] = [
    { limitBufferSize: 0, skipBufferSize: 0 },
    { limitBufferSize: 5, skipBufferSize: 0 },
    { limitBufferSize: 0, skipBufferSize: 5 },
    { limitBufferSize: 20, skipBufferSize: 3 },
    { limitBufferSize: 50, skipBufferSize: 20 }
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

describe('limit-buffer.test.ts', () => {
    describe('getLimitBufferQuery()', () => {
        it('should add the buffer sizes to the skip and limit', () => {
            const limitBuffer = createLimitBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 10, limit: 20 }),
                { limitBufferSize: 5, skipBufferSize: 3 }
            );
            assert.deepStrictEqual(getLimitBufferQuery(limitBuffer), { skip: 7, limit: 28 });
        });
        it('should not go below skip 0', () => {
            const limitBuffer = createLimitBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 2, limit: 20 }),
                { skipBufferSize: 5 }
            );
            assert.deepStrictEqual(getLimitBufferQuery(limitBuffer), { skip: 0, limit: 22 });
        });
        it('should have no limit for a query without a limit', () => {
            const limitBuffer = createLimitBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 10 }),
                { limitBufferSize: 5, skipBufferSize: 3 }
            );
            assert.deepStrictEqual(getLimitBufferQuery(limitBuffer), { skip: 7, limit: undefined });
        });
    });
    describe('resetLimitBuffer()', () => {
        it('should ask for a full query before it got rows', () => {
            const limitBuffer = createLimitBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), {});
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'INSERT', id: 'a', doc: doc('a', 1), previous: null
            });
            assert.strictEqual(result, 'runFullQueryAgain');
        });
        it('should be complete when the query returned fewer rows than requested', () => {
            const limitBuffer = createLimitBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), { limitBufferSize: 2 });
            const rows = [doc('a', 1), doc('b', 2), doc('c', 3)];
            resetLimitBuffer(limitBuffer, rows);
            assert.strictEqual(limitBuffer.complete, true);
            assert.deepStrictEqual(getLimitBufferResults(limitBuffer), rows.slice(0, 2));
        });
        it('should not be complete when the query returned as many rows as requested', () => {
            const limitBuffer = createLimitBuffer(getQueryParams({ sortDirection: 'asc', limit: 1 }), { limitBufferSize: 1 });
            resetLimitBuffer(limitBuffer, [doc('a', 1), doc('b', 2)]);
            assert.strictEqual(limitBuffer.complete, false);
        });
        it('should show the rows after the skipped rows of the buffer', () => {
            const limitBuffer = createLimitBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 1, limit: 2 }),
                { skipBufferSize: 1 }
            );
            resetLimitBuffer(limitBuffer, [doc('a', 1), doc('b', 2), doc('c', 3)]);
            assert.strictEqual(limitBuffer.offset, 0);
            assert.strictEqual(ids(getLimitBufferResults(limitBuffer)), 'b,c');
        });
    });
    describe('applyChangeEventToLimitBuffer()', () => {
        it('should refill the window from the buffer when a visible row is deleted', () => {
            const limitBuffer = createLimitBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), { limitBufferSize: 2 });
            const rows = [doc('a', 1), doc('b', 2), doc('c', 3), doc('d', 4)];
            resetLimitBuffer(limitBuffer, rows);
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'DELETE', id: 'a', doc: null, previous: rows[0]
            });
            assert.strictEqual(result, 'buffer');
            assert.strictEqual(ids(getLimitBufferResults(limitBuffer)), 'b,c');
            assert.strictEqual(ids(limitBuffer.buffer), 'b,c,d');
        });
        it('should not append a row that moves behind the last row of the buffer', () => {
            const limitBuffer = createLimitBuffer(getQueryParams({ sortDirection: 'asc', limit: 2 }), { limitBufferSize: 1 });
            const rows = [doc('a', 1), doc('b', 2), doc('c', 3)];
            resetLimitBuffer(limitBuffer, rows);
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'UPDATE', id: 'a', doc: doc('a', 99), previous: rows[0]
            });
            assert.strictEqual(result, 'buffer');
            assert.strictEqual(ids(limitBuffer.buffer), 'b,c');
        });
        it('should ask for a full query when a row is added in front of the skip window without a skip buffer', () => {
            const limitBuffer = createLimitBuffer(getQueryParams({ sortDirection: 'asc', skip: 1, limit: 1 }), { limitBufferSize: 1 });
            resetLimitBuffer(limitBuffer, [doc('b', 2), doc('c', 3)]);
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'INSERT', id: 'x', doc: doc('x', 0), previous: null
            });
            assert.strictEqual(result, 'runFullQueryAgain');
        });
        it('should take the row from the skip buffer when a row is added in front of the window', () => {
            const limitBuffer = createLimitBuffer(
                getQueryParams({ sortDirection: 'asc', skip: 2, limit: 1 }),
                { skipBufferSize: 1 }
            );
            // skip 1, limit 2: 'a' is skipped and not in the buffer
            resetLimitBuffer(limitBuffer, [doc('b', 2), doc('c', 3)]);
            assert.strictEqual(ids(getLimitBufferResults(limitBuffer)), 'c');
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'INSERT', id: 'x', doc: doc('x', 0), previous: null
            });
            assert.strictEqual(result, 'buffer');
            assert.strictEqual(limitBuffer.offset, 2);
            assert.strictEqual(ids(getLimitBufferResults(limitBuffer)), 'b');
        });
        it('should handle a query with a skip but without a limit', () => {
            const limitBuffer = createLimitBuffer(getQueryParams({ sortDirection: 'asc', skip: 1 }), { skipBufferSize: 1 });
            const rows = [doc('a', 1), doc('b', 2), doc('c', 3)];
            resetLimitBuffer(limitBuffer, rows);
            assert.strictEqual(ids(getLimitBufferResults(limitBuffer)), 'b,c');
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'INSERT', id: 'x', doc: doc('x', 0), previous: null
            });
            assert.notStrictEqual(result, 'runFullQueryAgain');
            assert.strictEqual(ids(getLimitBufferResults(limitBuffer)), 'a,b,c');
        });
    });
    describe('randomized against a full query', () => {
        const totalCounts: { [k in LimitBufferResult]: number } = {
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
                            const limitBuffer = createLimitBuffer(queryParams, sizes);
                            fillLimitBuffer(limitBuffer, docs);

                            for (let i = 0; i < EVENTS_PER_RUN; i++) {
                                const changeEvent = randomChangeEvent(docs, random, newId, getWeights(i));
                                applyToDocs(changeEvent);

                                const result = applyChangeEventToLimitBuffer(limitBuffer, changeEvent);
                                totalCounts[result]++;
                                if (result === 'runFullQueryAgain') {
                                    fillLimitBuffer(limitBuffer, docs);
                                }

                                const context = 'event #' + i + ' (' + changeEvent.operation + ', ' + result + ')';

                                // the visible result equals the full query
                                assert.strictEqual(
                                    ids(getLimitBufferResults(limitBuffer)),
                                    ids(runQuery(docs, queryParams, skip, query.limit)),
                                    'visible result differs from full query at ' + context
                                );

                                // the buffer is an exact slice of the full result
                                const fullResult = runQuery(docs, queryParams, 0, undefined);
                                if (limitBuffer.buffer.length > 0) {
                                    assert.strictEqual(
                                        ids(limitBuffer.buffer),
                                        ids(fullResult.slice(limitBuffer.offset, limitBuffer.offset + limitBuffer.buffer.length)),
                                        'buffer is not an exact slice of the full result at ' + context
                                    );
                                } else {
                                    // an empty buffer only knows an upper bound of the rows before it
                                    assert.ok(limitBuffer.complete, 'empty buffer must be complete at ' + context);
                                    assert.ok(fullResult.length <= limitBuffer.offset, 'offset is no upper bound at ' + context);
                                }
                                if (limitBuffer.complete) {
                                    assert.ok(
                                        limitBuffer.offset + limitBuffer.buffer.length >= fullResult.length,
                                        'complete buffer misses rows at ' + context
                                    );
                                }

                                // the buffer keeps no more rows than requested on both sides
                                assert.ok(skip - limitBuffer.offset <= (sizes.skipBufferSize || 0), 'too many rows before the window');
                                if (query.limit) {
                                    assert.ok(
                                        limitBuffer.buffer.length <= Math.max(0, skip - limitBuffer.offset) + query.limit + (sizes.limitBufferSize || 0),
                                        'too many rows after the window'
                                    );
                                }

                                // the key map matches the buffer
                                assert.strictEqual(limitBuffer.keyDocumentMap.size, limitBuffer.buffer.length);
                                limitBuffer.buffer.forEach(d => assert.strictEqual(limitBuffer.keyDocumentMap.get(d._id), d));
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
