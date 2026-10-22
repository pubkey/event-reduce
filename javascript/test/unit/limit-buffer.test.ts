import * as assert from 'assert';
import {
    applyChangeEventToLimitBuffer,
    createLimitBuffer,
    getLimitBufferQueryLimit,
    getLimitBufferResults,
    resetLimitBuffer
} from '../../src/index.js';
import type { LimitBufferResult } from '../../src/index.js';
import type { ChangeEvent, QueryParams } from '../../src/types/index.js';

/**
 * Randomized test of the limit buffer against a full query.
 * After every event, the visible result must equal the full query,
 * and the buffer must be an exact prefix of the full result.
 */

type Doc = {
    _id: string;
    gender: 'm' | 'f';
    age: number;
};

type TestQuery = {
    sortDirection: 'asc' | 'desc';
    skip?: number;
    limit: number;
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
function runQuery(docs: Map<string, Doc>, queryParams: QueryParams<Doc>, limit: number): Doc[] {
    const skip = queryParams.skip ? queryParams.skip : 0;
    return Array.from(docs.values())
        .filter(queryParams.queryMatcher)
        .sort(queryParams.sortComparator)
        .slice(skip, skip + limit);
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

const QUERIES: TestQuery[] = [
    { sortDirection: 'asc', limit: 20 },
    { sortDirection: 'desc', limit: 20 },
    { sortDirection: 'asc', skip: 10, limit: 20 },
    { sortDirection: 'desc', skip: 10, limit: 20 },
    { sortDirection: 'asc', limit: 1 },
    { sortDirection: 'desc', skip: 3, limit: 5 }
];
const BUFFER_SIZES = [0, 5, 20, 50];
const INITIAL_ROWS = [0, 30, 300];
const EVENTS_PER_RUN = 1000;

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
    describe('createLimitBuffer()', () => {
        it('should throw on a query without a limit', () => {
            const queryParams = getQueryParams({ sortDirection: 'asc', limit: 0 });
            delete queryParams.limit;
            assert.throws(() => createLimitBuffer(queryParams, 5, []), /LB_NO_LIMIT/);
        });
        it('should be complete when the query returned fewer rows than requested', () => {
            const queryParams = getQueryParams({ sortDirection: 'asc', limit: 2 });
            const rows: Doc[] = [
                { _id: 'a', gender: 'f', age: 1 },
                { _id: 'b', gender: 'f', age: 2 },
                { _id: 'c', gender: 'f', age: 3 }
            ];
            const limitBuffer = createLimitBuffer(queryParams, 2, rows);
            assert.strictEqual(getLimitBufferQueryLimit(limitBuffer), 4);
            assert.strictEqual(limitBuffer.complete, true);
            assert.deepStrictEqual(getLimitBufferResults(limitBuffer), rows.slice(0, 2));
        });
        it('should not be complete when the query returned as many rows as requested', () => {
            const queryParams = getQueryParams({ sortDirection: 'asc', limit: 1 });
            const rows: Doc[] = [
                { _id: 'a', gender: 'f', age: 1 },
                { _id: 'b', gender: 'f', age: 2 }
            ];
            assert.strictEqual(createLimitBuffer(queryParams, 1, rows).complete, false);
        });
    });
    describe('applyChangeEventToLimitBuffer()', () => {
        it('should refill the window from the buffer when a visible row is deleted', () => {
            const queryParams = getQueryParams({ sortDirection: 'asc', limit: 2 });
            const rows: Doc[] = [
                { _id: 'a', gender: 'f', age: 1 },
                { _id: 'b', gender: 'f', age: 2 },
                { _id: 'c', gender: 'f', age: 3 },
                { _id: 'd', gender: 'f', age: 4 }
            ];
            const limitBuffer = createLimitBuffer(queryParams, 2, rows);
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'DELETE',
                id: 'a',
                doc: null,
                previous: rows[0]
            });
            assert.strictEqual(result, 'buffer');
            assert.strictEqual(ids(getLimitBufferResults(limitBuffer)), 'b,c');
            assert.strictEqual(ids(limitBuffer.buffer), 'b,c,d');
        });
        it('should not append a row that moves behind the last row of the buffer', () => {
            const queryParams = getQueryParams({ sortDirection: 'asc', limit: 2 });
            const rows: Doc[] = [
                { _id: 'a', gender: 'f', age: 1 },
                { _id: 'b', gender: 'f', age: 2 },
                { _id: 'c', gender: 'f', age: 3 }
            ];
            const limitBuffer = createLimitBuffer(queryParams, 1, rows);
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'UPDATE',
                id: 'a',
                doc: { _id: 'a', gender: 'f', age: 99 },
                previous: rows[0]
            });
            assert.strictEqual(result, 'buffer');
            assert.strictEqual(ids(limitBuffer.buffer), 'b,c');
        });
        it('should ask for a full query when a row is added in front of the skip window', () => {
            const queryParams = getQueryParams({ sortDirection: 'asc', skip: 1, limit: 1 });
            const rows: Doc[] = [
                { _id: 'b', gender: 'f', age: 2 },
                { _id: 'c', gender: 'f', age: 3 }
            ];
            const limitBuffer = createLimitBuffer(queryParams, 1, rows);
            const doc: Doc = { _id: 'x', gender: 'f', age: 1 };
            const result = applyChangeEventToLimitBuffer<Doc>(limitBuffer, {
                operation: 'INSERT',
                id: doc._id,
                doc,
                previous: null
            });
            assert.strictEqual(result, 'runFullQueryAgain');
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
            for (const bufferSize of BUFFER_SIZES) {
                for (const initialRows of INITIAL_ROWS) {
                    seed++;
                    const runSeed = seed;
                    it(
                        'sort ' + query.sortDirection + ', skip ' + (query.skip || 0) + ', limit ' + query.limit +
                        ', bufferSize ' + bufferSize + ', ' + initialRows + ' initial rows',
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
                            const limitBuffer = createLimitBuffer(
                                queryParams,
                                bufferSize,
                                runQuery(docs, queryParams, query.limit + bufferSize)
                            );

                            for (let i = 0; i < EVENTS_PER_RUN; i++) {
                                const changeEvent = randomChangeEvent(docs, random, newId, getWeights(i));
                                applyToDocs(changeEvent);

                                const result = applyChangeEventToLimitBuffer(limitBuffer, changeEvent);
                                totalCounts[result]++;
                                if (result === 'runFullQueryAgain') {
                                    resetLimitBuffer(limitBuffer, runQuery(docs, queryParams, getLimitBufferQueryLimit(limitBuffer)));
                                }

                                const context = 'event #' + i + ' (' + changeEvent.operation + ', ' + result + ')';

                                // the visible result equals the full query
                                assert.strictEqual(
                                    ids(getLimitBufferResults(limitBuffer)),
                                    ids(runQuery(docs, queryParams, query.limit)),
                                    'visible result differs from full query at ' + context
                                );

                                // the buffer is an exact prefix of the full result
                                const fullResult = runQuery(docs, queryParams, Infinity);
                                assert.strictEqual(
                                    ids(limitBuffer.buffer),
                                    ids(fullResult.slice(0, limitBuffer.buffer.length)),
                                    'buffer is not a prefix of the full result at ' + context
                                );
                                if (limitBuffer.complete) {
                                    assert.strictEqual(
                                        limitBuffer.buffer.length,
                                        fullResult.length,
                                        'complete buffer misses rows at ' + context
                                    );
                                }
                                assert.ok(limitBuffer.buffer.length <= getLimitBufferQueryLimit(limitBuffer));

                                // the key map matches the buffer
                                assert.strictEqual(limitBuffer.keyDocumentMap.size, limitBuffer.buffer.length);
                                limitBuffer.buffer.forEach(doc => assert.strictEqual(limitBuffer.keyDocumentMap.get(doc._id), doc));
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
