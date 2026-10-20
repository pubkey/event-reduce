import * as assert from 'assert';
import {
    calculateActionName,
    runAction,
    sortParamsChanged
} from '../../src/index.js';
import { getProperty } from '../../src/util.js';
import type {
    ChangeEvent,
    QueryParams,
    StateResolveFunctionInput
} from '../../src/types/index.js';

type Doc = {
    id: string;
    scores: number[];
    items: { rank: number; }[];
};

/**
 * Sorts by the second entry of the scores array
 * and then by the rank of the first item.
 */
const queryParams: QueryParams<Doc> = {
    primaryKey: 'id',
    sortFields: ['scores.1', 'items.0.rank', 'id'],
    limit: 5,
    queryMatcher: doc => doc.scores[0] > 10,
    sortComparator: (a, b) => {
        if (a.scores[1] !== b.scores[1]) {
            return a.scores[1] < b.scores[1] ? -1 : 1;
        }
        if (a.items[0].rank !== b.items[0].rank) {
            return a.items[0].rank < b.items[0].rank ? -1 : 1;
        }
        return a.id < b.id ? -1 : 1;
    }
};

function randomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

function randomDoc(id: string): Doc {
    return {
        id,
        scores: [randomInt(30), randomInt(10)],
        items: [{ rank: randomInt(10) }]
    };
}

describe('array-index-sort.test.ts', () => {
    describe('getProperty()', () => {
        it('should get values from array indexes', () => {
            const doc = { scores: [3, 7], items: [{ rank: 4 }] };
            assert.strictEqual(getProperty(doc, 'scores.1'), 7);
            assert.strictEqual(getProperty(doc, 'items.0.rank'), 4);
            assert.strictEqual(getProperty(doc, 'items.1.rank'), undefined);
        });
    });
    describe('sortParamsChanged()', () => {
        function getInput(previous: Doc, doc: Doc): StateResolveFunctionInput<Doc> {
            return {
                queryParams,
                changeEvent: {
                    operation: 'UPDATE',
                    id: doc.id,
                    doc,
                    previous
                },
                previousResults: []
            };
        }
        it('should be true when a sorted array entry changed', () => {
            const previous = { id: 'a', scores: [20, 1], items: [{ rank: 1 }] };
            assert.strictEqual(sortParamsChanged(getInput(previous, { ...previous, scores: [20, 2] })), true);
            assert.strictEqual(sortParamsChanged(getInput(previous, { ...previous, items: [{ rank: 2 }] })), true);
        });
        it('should be false when only a not sorted array entry changed', () => {
            const previous = { id: 'a', scores: [20, 1], items: [{ rank: 1 }] };
            assert.strictEqual(sortParamsChanged(getInput(previous, { ...previous, scores: [21, 1] })), false);
        });
    });
    describe('calculateActionName() + runAction()', () => {
        it('should have the same results as running the full query', () => {
            const db = new Map<string, Doc>();
            const runFullQuery = () => Array.from(db.values())
                .filter(queryParams.queryMatcher)
                .sort(queryParams.sortComparator)
                .slice(0, queryParams.limit);

            let results = runFullQuery();
            for (let i = 0; i < 1000; i++) {
                const ids = Array.from(db.keys());
                let changeEvent: ChangeEvent<Doc>;
                if (ids.length === 0 || i % 3 === 0) {
                    const doc = randomDoc('id' + i);
                    db.set(doc.id, doc);
                    changeEvent = { operation: 'INSERT', id: doc.id, doc, previous: null };
                } else {
                    const id = ids[randomInt(ids.length)];
                    const previous = db.get(id) as Doc;
                    if (i % 7 === 0) {
                        db.delete(id);
                        changeEvent = { operation: 'DELETE', id, doc: null, previous };
                    } else {
                        const doc = { ...randomDoc(id), id };
                        db.set(id, doc);
                        changeEvent = { operation: 'UPDATE', id, doc, previous };
                    }
                }

                const input = { queryParams, changeEvent, previousResults: results };
                const action = calculateActionName(input);
                if (action === 'runFullQueryAgain') {
                    results = runFullQuery();
                } else {
                    results = runAction(action, queryParams, changeEvent, results.slice());
                }
                assert.deepStrictEqual(results, runFullQuery(), 'wrong results after action ' + action);
            }
        });
    });
});
