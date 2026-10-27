import * as fs from 'fs';
import * as path from 'path';
import {
    calculateActionName,
    getStateSet
} from '../../src/index.js';
import type {
    ActionName,
    ChangeEvent,
    QueryParams,
    StateResolveFunctionInput
} from '../../src/types/index.js';

/**
 * Test cases for the implementations in other languages (rust, dart, kotlin, swift, csharp, python).
 * They do not create or optimize the BDD, they only resolve the BDD that was created here.
 * So they only have to show that they resolve the same state set and action as this implementation.
 * Each case has a query, the previous results and a change event,
 * and the state set and action that this implementation calculates for them.
 *
 * The query is always: age > minAge, sorted by age, then by id.
 * The previous results are always the real results of the query over a small database,
 * so the cases contain only state sets that can happen.
 * There is one case for each state set that was found.
 */

export type PortTestDoc = { id: string; age: number; };
export type PortTestQuery = { minAge: number; skip: number | null; limit: number | null; };
export type PortTestCase = {
    query: PortTestQuery;
    previousResults: PortTestDoc[];
    changeEvent: {
        operation: 'INSERT' | 'UPDATE' | 'DELETE';
        id: string;
        doc: PortTestDoc | null;
        previous: PortTestDoc | null;
    };
    stateSet: string;
    action: ActionName;
};

export const PORT_TEST_CASES_FILE = 'test/fixtures/port-test-cases.json';

/**
 * Path of the test cases file, works from the source and from the build output.
 */
export function getPortTestCasesPath(): string {
    let dir = __dirname;
    while (!fs.existsSync(path.join(dir, 'package.json'))) {
        dir = path.dirname(dir);
    }
    return path.join(dir, PORT_TEST_CASES_FILE);
}

export function getPortTestQueryParams(query: PortTestQuery): QueryParams<PortTestDoc> {
    return {
        primaryKey: 'id',
        sortFields: ['age', 'id'],
        skip: query.skip === null ? undefined : query.skip,
        limit: query.limit === null ? undefined : query.limit,
        queryMatcher: doc => doc.age > query.minAge,
        sortComparator: (a, b) => {
            if (a.age !== b.age) {
                return a.age < b.age ? -1 : 1;
            }
            return a.id < b.id ? -1 : 1;
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

export function generatePortTestCases(): PortTestCase[] {
    const random = seededRandom(1);
    const int = (max: number) => Math.floor(random() * max);
    const pick = <T>(items: T[]): T => items[int(items.length)];
    const caseByStateSet = new Map<string, PortTestCase>();

    for (let run = 0; run < 100000; run++) {
        const query: PortTestQuery = {
            minAge: pick([0, 5]),
            skip: pick([null, 0, 1, 2, 3]),
            limit: pick([null, 1, 2, 3, 4, 6])
        };
        const queryParams = getPortTestQueryParams(query);
        const db: PortTestDoc[] = [];
        const dbSize = int(12);
        for (let i = 0; i < dbSize; i++) {
            db.push({ id: 'd' + i, age: int(12) });
        }
        const skip = query.skip === null ? 0 : query.skip;
        const previousResults = db
            .filter(queryParams.queryMatcher)
            .sort(queryParams.sortComparator)
            .slice(skip, query.limit === null ? undefined : skip + query.limit);

        let changeEvent: ChangeEvent<PortTestDoc>;
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

        const input: StateResolveFunctionInput<PortTestDoc> = { queryParams, changeEvent, previousResults };
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

    return Array.from(caseByStateSet.values())
        .sort((a, b) => a.stateSet < b.stateSet ? -1 : 1);
}

export function portTestCasesToJson(cases: PortTestCase[]): string {
    // one case per line, so diffs stay readable
    return '[\n' + cases.map(c => '  ' + JSON.stringify(c)).join(',\n') + '\n]\n';
}
