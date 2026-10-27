import * as fs from 'fs';
import * as path from 'path';
import {
    calculateActionName,
    getStateSet
} from '../../src/index.js';
import { packedBddString } from '../../src/bdd/bdd.generated.js';
import type {
    ActionName,
    ChangeEvent,
    QueryParams,
    StateResolveFunctionInput
} from '../../src/types/index.js';

/**
 * The test suite in ../test-suite is shared by all implementations,
 * see ../test-suite/README.md.
 * This file has the types of the suite and creates test-suite/state-sets.json.
 */

export type TestSuiteDoc = { id: string; age: number; name?: string; };
export type TestSuiteQuery = { minAge: number; skip: number | null; limit: number | null; desc?: boolean; };
export type TestSuiteChangeEvent = {
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    id: string;
    doc: TestSuiteDoc | null;
    previous: TestSuiteDoc | null;
};
export type StateSetCase = {
    query: TestSuiteQuery;
    previousResults: TestSuiteDoc[];
    changeEvent: TestSuiteChangeEvent;
    stateSet: string;
    action: ActionName;
};
export type StateSets = {
    packedBddString: string;
    cases: StateSetCase[];
};

export function getTestSuitePath(file: string): string {
    let dir = __dirname;
    while (!fs.existsSync(path.join(dir, 'test-suite', 'README.md'))) {
        dir = path.dirname(dir);
    }
    return path.join(dir, 'test-suite', file);
}

/**
 * The query of all test cases: age > minAge, sorted by age, then by id.
 */
export function getTestSuiteQueryParams(query: TestSuiteQuery): QueryParams<TestSuiteDoc> {
    const direction = query.desc ? -1 : 1;
    return {
        primaryKey: 'id',
        sortFields: ['age', 'id'],
        skip: query.skip === null ? undefined : query.skip,
        limit: query.limit === null ? undefined : query.limit,
        queryMatcher: doc => doc.age > query.minAge,
        sortComparator: (a, b) => {
            if (a.age !== b.age) {
                return (a.age < b.age ? -direction : direction) as 1 | -1;
            }
            return (a.id < b.id ? -direction : direction) as 1 | -1;
        }
    };
}

/**
 * Seeded random number generator (mulberry32),
 * so that every run produces the same cases.
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
 * Creates one realistic case for each state set that is found:
 * the previous results are always the real results of the query over a small database,
 * so the cases contain only state sets that can happen.
 * The state set and action are the ones of this implementation.
 */
export function generateStateSets(): StateSets {
    const random = seededRandom(1);
    const int = (max: number) => Math.floor(random() * max);
    const pick = <T>(items: T[]): T => items[int(items.length)];
    const caseByStateSet = new Map<string, StateSetCase>();

    for (let run = 0; run < 100000; run++) {
        const query: TestSuiteQuery = {
            minAge: pick([0, 5]),
            skip: pick([null, 0, 1, 2, 3]),
            limit: pick([null, 1, 2, 3, 4, 6])
        };
        const queryParams = getTestSuiteQueryParams(query);
        const db: TestSuiteDoc[] = [];
        const dbSize = int(12);
        for (let i = 0; i < dbSize; i++) {
            db.push({ id: 'd' + i, age: int(12) });
        }
        const skip = query.skip === null ? 0 : query.skip;
        const previousResults = db
            .filter(queryParams.queryMatcher)
            .sort(queryParams.sortComparator)
            .slice(skip, query.limit === null ? undefined : skip + query.limit);

        let changeEvent: ChangeEvent<TestSuiteDoc>;
        const operation = db.length === 0 ? 0 : int(3);
        if (operation === 0) {
            const doc = { id: 'n' + int(10), age: int(12) };
            changeEvent = { operation: 'INSERT', id: doc.id, doc, previous: null };
        } else if (operation === 1) {
            const previous = pick(db);
            // sometimes only a field that is not sorted by changes
            const doc = { id: previous.id, age: random() < 0.2 ? previous.age : int(12) };
            changeEvent = { operation: 'UPDATE', id: doc.id, doc, previous };
        } else {
            const previous = pick(db);
            changeEvent = { operation: 'DELETE', id: previous.id, doc: null, previous };
        }

        const input: StateResolveFunctionInput<TestSuiteDoc> = { queryParams, changeEvent, previousResults };
        const stateSet = getStateSet(input);
        if (caseByStateSet.has(stateSet)) {
            continue;
        }
        caseByStateSet.set(stateSet, {
            query,
            previousResults,
            changeEvent: {
                operation: changeEvent.operation,
                id: changeEvent.id,
                doc: changeEvent.doc,
                previous: changeEvent.previous
            },
            stateSet,
            action: calculateActionName(input)
        });
    }

    return {
        packedBddString,
        cases: Array.from(caseByStateSet.values()).sort((a, b) => a.stateSet < b.stateSet ? -1 : 1)
    };
}

export function stateSetsToJson(stateSets: StateSets): string {
    // one case per line, so diffs stay readable
    return '{\n' +
        '  "packedBddString": ' + JSON.stringify(stateSets.packedBddString) + ',\n' +
        '  "cases": [\n' +
        stateSets.cases.map(c => '    ' + JSON.stringify(c)).join(',\n') +
        '\n  ]\n}\n';
}
