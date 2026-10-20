import * as assert from 'assert';
import {
    calculateActionName,
    runAction
} from '../../src/index.js';
import type {
    ChangeEvent,
    QueryParams
} from '../../src/types/index.js';

/**
 * The id is not stored in a top-level field
 * but is a compound key inside of a nested object.
 */
type Doc = {
    key: { team: string; num: number; };
    age: number;
};

function getDocumentId(doc: Doc): string {
    return doc.key.team + '|' + doc.key.num;
}

function getQueryParams(limit?: number, skip?: number): QueryParams<Doc> {
    return {
        primaryKey: 'unused',
        getDocumentId,
        sortFields: ['age', 'key.team', 'key.num'],
        limit,
        skip,
        queryMatcher: doc => doc.age > 10,
        sortComparator: (a, b) => {
            if (a.age !== b.age) {
                return a.age < b.age ? -1 : 1;
            }
            return getDocumentId(a) < getDocumentId(b) ? -1 : 1;
        }
    };
}

function randomInt(max: number): number {
    return Math.floor(Math.random() * max);
}

function randomDoc(team: string, num: number): Doc {
    return { key: { team, num }, age: randomInt(40) };
}

describe('get-document-id.test.ts', () => {
    const cases: [string, number | undefined, number | undefined, boolean][] = [
        ['no limit', undefined, undefined, false],
        ['limit', 5, undefined, false],
        ['limit + keyDocumentMap', 5, undefined, true],
        ['skip + limit', 5, 3, false],
        ['skip + limit + keyDocumentMap', 5, 3, true]
    ];
    cases.forEach(([name, limit, skip, useMap]) => {
        it('should have the same results as running the full query (' + name + ')', () => {
            const queryParams = getQueryParams(limit, skip);
            const db = new Map<string, Doc>();
            const runFullQuery = () => {
                const all = Array.from(db.values())
                    .filter(queryParams.queryMatcher)
                    .sort(queryParams.sortComparator);
                const start = skip ? skip : 0;
                return limit ? all.slice(start, start + limit) : all.slice(start);
            };
            const toMap = (docs: Doc[]) => new Map(docs.map(doc => [getDocumentId(doc), doc]));

            let results = runFullQuery();
            let keyDocumentMap = toMap(results);
            for (let i = 0; i < 1000; i++) {
                const ids = Array.from(db.keys());
                let changeEvent: ChangeEvent<Doc>;
                if (ids.length === 0 || i % 3 === 0) {
                    const doc = randomDoc(['a', 'b'][i % 2], i);
                    db.set(getDocumentId(doc), doc);
                    changeEvent = { operation: 'INSERT', id: getDocumentId(doc), doc, previous: null };
                } else {
                    const id = ids[randomInt(ids.length)];
                    const previous = db.get(id) as Doc;
                    if (i % 7 === 0) {
                        db.delete(id);
                        changeEvent = { operation: 'DELETE', id, doc: null, previous };
                    } else {
                        const doc = { ...randomDoc(previous.key.team, previous.key.num), key: previous.key };
                        db.set(id, doc);
                        changeEvent = { operation: 'UPDATE', id, doc, previous };
                    }
                }

                const input = {
                    queryParams,
                    changeEvent,
                    previousResults: results,
                    keyDocumentMap: useMap ? keyDocumentMap : undefined
                };
                const action = calculateActionName(input);
                if (action === 'runFullQueryAgain') {
                    results = runFullQuery();
                    keyDocumentMap = toMap(results);
                } else {
                    results = runAction(
                        action,
                        queryParams,
                        changeEvent,
                        results,
                        useMap ? keyDocumentMap : undefined
                    );
                }
                assert.deepStrictEqual(results, runFullQuery(), 'wrong results after action ' + action);
                if (useMap) {
                    assert.deepStrictEqual(
                        Array.from(keyDocumentMap.keys()).sort(),
                        results.map(getDocumentId).sort(),
                        'keyDocumentMap out of sync after action ' + action
                    );
                }
            }
        });
    });
});
