import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
    applyChangeEventToLimitBuffer,
    createLimitBuffer,
    getLimitBufferQueryLimit,
    getLimitBufferResults,
    LimitBufferResult,
    resetLimitBuffer
} from '../src/limit-buffer';
import {
    EventGenerator,
    getTestQueryParams,
    idsOf,
    MemoryTable,
    TestQuery
} from './limit-buffer-memory-db';

/**
 * Randomized test of the limit buffer against a full query.
 * After every event, the visible result must equal the full query,
 * and the buffer must be an exact prefix of the full result.
 * Run with: npm run test:unit
 */

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
const EVENTS_PER_RUN = 1500;

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
                        const generator = new EventGenerator(runSeed);
                        const table = new MemoryTable();
                        for (let i = 0; i < initialRows; i++) {
                            const doc = generator.randomHuman();
                            table.applyChangeEvent({ operation: 'INSERT', id: doc._id, doc, previous: null });
                        }
                        const queryParams = getTestQueryParams(query);
                        const limitBuffer = createLimitBuffer(
                            queryParams,
                            bufferSize,
                            table.query(queryParams, queryParams.limit + bufferSize)
                        );

                        for (let i = 0; i < EVENTS_PER_RUN; i++) {
                            const changeEvent = generator.randomChangeEvent(table, getWeights(i));
                            table.applyChangeEvent(changeEvent);

                            const result = applyChangeEventToLimitBuffer(limitBuffer, changeEvent);
                            totalCounts[result]++;
                            if (result === 'runFullQueryAgain') {
                                resetLimitBuffer(limitBuffer, table.query(queryParams, getLimitBufferQueryLimit(limitBuffer)));
                            }

                            const context = 'event #' + i + ' (' + changeEvent.operation + ', ' + result + ')';

                            // the visible result equals the full query
                            assert.strictEqual(
                                idsOf(getLimitBufferResults(limitBuffer)),
                                idsOf(table.query(queryParams)),
                                'visible result differs from full query at ' + context
                            );

                            // the buffer is an exact prefix of the full result
                            const fullResult = table.query(queryParams, Infinity);
                            assert.strictEqual(
                                idsOf(limitBuffer.buffer),
                                idsOf(fullResult.slice(0, limitBuffer.buffer.length)),
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
        console.log('limit buffer results over all runs: ' + JSON.stringify(totalCounts));
        assert.ok(totalCounts.eventReduce > 0);
        assert.ok(totalCounts.buffer > 0);
        assert.ok(totalCounts.runFullQueryAgain > 0);
    });
});
