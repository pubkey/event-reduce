/**
 * Benchmark comparing old vs new state-resolver performance.
 *
 * This script imports the original (unoptimized) functions defined inline,
 * and compares them against the optimized versions from the module.
 */
import {
    getStateSet,
    stateResolveFunctions,
    orderedStateList
} from '../../src/states/index.js';
import { StateResolveFunctionInput, StateName, StateResolveFunction } from '../../src/types/index.js';
import { randomHuman } from '../../src/truth-table-generator/data-generator.js';
import { Human } from '../../src/truth-table-generator/types.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';
import { getProperty, lastOfArray } from '../../src/util.js';

const pseudoCollection = mingoCollectionCreator();

// -------- Original (unoptimized) implementations --------

const oldHasLimit: StateResolveFunction<any> = (input) => {
    return !!input.queryParams.limit;
};

const oldIsFindOne: StateResolveFunction<any> = (input) => {
    return input.queryParams.limit === 1;
};

const oldHasSkip: StateResolveFunction<any> = (input) => {
    if (input.queryParams.skip && input.queryParams.skip > 0) {
        return true;
    } else {
        return false;
    }
};

const oldIsDelete: StateResolveFunction<any> = (input) => {
    return input.changeEvent.operation === 'DELETE';
};

const oldIsInsert: StateResolveFunction<any> = (input) => {
    return input.changeEvent.operation === 'INSERT';
};

const oldIsUpdate: StateResolveFunction<any> = (input) => {
    return input.changeEvent.operation === 'UPDATE';
};

const oldWasLimitReached: StateResolveFunction<any> = (input) => {
    return oldHasLimit(input) && input.previousResults.length >= (input.queryParams.limit as number);
};

const oldSortParamsChanged: StateResolveFunction<any> = (input) => {
    const sortFields = input.queryParams.sortFields;
    const prev = input.changeEvent.previous;
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    if (!prev) {
        return true;
    }
    for (let i = 0; i < sortFields.length; i++) {
        const field = sortFields[i];
        const beforeData = getProperty(prev, field);
        const afterData = getProperty(doc, field);
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};

const oldWasInResult: StateResolveFunction<any> = (input) => {
    const id = input.changeEvent.id;
    if (input.keyDocumentMap) {
        const has = input.keyDocumentMap.has(id);
        return has;
    } else {
        const primary = input.queryParams.primaryKey;
        const results = input.previousResults;
        for (let i = 0; i < results.length; i++) {
            const item = results[i];
            if (item[primary] === id) {
                return true;
            }
        }
        return false;
    }
};

const oldWasFirst: StateResolveFunction<any> = (input) => {
    const first = input.previousResults[0];
    if (first && first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    } else {
        return false;
    }
};

const oldWasLast: StateResolveFunction<any> = (input) => {
    const last = lastOfArray(input.previousResults);
    if (last && last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    } else {
        return false;
    }
};

const oldWasSortedBeforeFirst: StateResolveFunction<any> = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    const first = input.previousResults[0];
    if (!first) {
        return false;
    }
    if (first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(prev, first);
    return comp < 0;
};

const oldWasSortedAfterLast: StateResolveFunction<any> = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    const last = lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }
    if (last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(prev, last);
    return comp > 0;
};

const oldIsSortedBeforeFirst: StateResolveFunction<any> = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const first = input.previousResults[0];
    if (!first) {
        return false;
    }
    if (first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(doc, first);
    return comp < 0;
};

const oldIsSortedAfterLast: StateResolveFunction<any> = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const last = lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }
    if (last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(doc, last);
    return comp > 0;
};

const oldWasMatching: StateResolveFunction<any> = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    return input.queryParams.queryMatcher(prev);
};

const oldDoesMatchNow: StateResolveFunction<any> = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const ret = input.queryParams.queryMatcher(doc);
    return ret;
};

const oldWasResultsEmpty: StateResolveFunction<any> = (input) => {
    return input.previousResults.length === 0;
};

const oldStateResolveFunctions: Record<string, StateResolveFunction<any>> = {
    isInsert: oldIsInsert,
    isUpdate: oldIsUpdate,
    isDelete: oldIsDelete,
    hasLimit: oldHasLimit,
    isFindOne: oldIsFindOne,
    hasSkip: oldHasSkip,
    wasResultsEmpty: oldWasResultsEmpty,
    wasLimitReached: oldWasLimitReached,
    wasFirst: oldWasFirst,
    wasLast: oldWasLast,
    sortParamsChanged: oldSortParamsChanged,
    wasInResult: oldWasInResult,
    wasSortedBeforeFirst: oldWasSortedBeforeFirst,
    wasSortedAfterLast: oldWasSortedAfterLast,
    isSortedBeforeFirst: oldIsSortedBeforeFirst,
    isSortedAfterLast: oldIsSortedAfterLast,
    wasMatching: oldWasMatching,
    doesMatchNow: oldDoesMatchNow
};

function oldGetStateSet<DocType>(input: StateResolveFunctionInput<DocType>): string {
    let set = '';
    for (let i = 0; i < orderedStateList.length; i++) {
        const name: StateName = orderedStateList[i];
        const fn = oldStateResolveFunctions[name];
        const value = fn(input);
        const add = value ? '1' : '0';
        set += add;
    }
    return set;
}

// -------- Benchmark Helpers --------

function buildUpdateInput(resultsCount: number): StateResolveFunctionInput<Human> {
    const previous = randomHuman();
    const doc = { ...previous, age: previous.age + 10 };
    const results: Human[] = [];
    for (let i = 0; i < resultsCount; i++) {
        results.push(randomHuman());
    }
    if (resultsCount > 0) {
        results[0] = previous;
    }
    const keyDocMap: Map<string, Human> = new Map();
    results.forEach(r => keyDocMap.set(r._id, r));

    return {
        changeEvent: {
            operation: 'UPDATE',
            doc,
            previous,
            id: previous._id
        },
        previousResults: results,
        queryParams: pseudoCollection.getQueryParams({
            selector: { age: { $gt: 10 } },
            sort: ['age', '_id'],
            limit: resultsCount + 5
        }),
        keyDocumentMap: keyDocMap
    };
}

function benchmarkFn(fn: () => void, iterations: number): number {
    // Warm up
    for (let i = 0; i < 200; i++) {
        fn();
    }
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    return performance.now() - start;
}

// -------- Tests --------

describe('benchmark: old vs new state-resolver', () => {
    it('compare getStateSet performance', () => {
        const input = buildUpdateInput(100);
        const iterations = 20_000;

        const oldTime = benchmarkFn(() => oldGetStateSet(input), iterations);
        const newTime = benchmarkFn(() => getStateSet(input), iterations);

        const oldOps = Math.round(iterations / (oldTime / 1000));
        const newOps = Math.round(iterations / (newTime / 1000));
        const speedup = ((oldTime - newTime) / oldTime * 100).toFixed(1);

        console.log('');
        console.log('    ┌──────────────────────────────────────────────────────┐');
        console.log('    │         getStateSet (UPDATE, 100 results)            │');
        console.log('    ├──────────────────────────────────────────────────────┤');
        console.log(`    │  Old: ${oldOps.toLocaleString().padStart(10)} ops/sec  (${(oldTime / iterations).toFixed(4)}ms/call)  │`);
        console.log(`    │  New: ${newOps.toLocaleString().padStart(10)} ops/sec  (${(newTime / iterations).toFixed(4)}ms/call)  │`);
        console.log(`    │  Speedup: ${speedup.padStart(5)}%                                  │`);
        console.log('    └──────────────────────────────────────────────────────┘');
    });

    it('compare individual function performance', () => {
        const input = buildUpdateInput(100);
        const iterations = 100_000;

        const names = Object.keys(stateResolveFunctions) as StateName[];

        console.log('');
        console.log('    ┌────────────────────────────┬────────────────┬────────────────┬──────────┐');
        console.log('    │ Function                   │ Old (ops/sec)  │ New (ops/sec)  │ Speedup  │');
        console.log('    ├────────────────────────────┼────────────────┼────────────────┼──────────┤');

        for (const name of names) {
            const oldFn = oldStateResolveFunctions[name];
            const newFn = stateResolveFunctions[name];

            const oldTime = benchmarkFn(() => oldFn(input), iterations);
            const newTime = benchmarkFn(() => newFn(input), iterations);

            const oldOps = Math.round(iterations / (oldTime / 1000));
            const newOps = Math.round(iterations / (newTime / 1000));
            const speedup = ((oldTime - newTime) / oldTime * 100).toFixed(1);

            console.log(
                `    │ ${name.padEnd(27)}│ ${oldOps.toLocaleString().padStart(14)} │ ${newOps.toLocaleString().padStart(14)} │ ${(speedup + '%').padStart(8)} │`
            );
        }

        console.log('    └────────────────────────────┴────────────────┴────────────────┴──────────┘');
    });

    it('compare getStateSet with varying result set sizes', () => {
        const sizes = [0, 10, 100, 500, 1000];
        const iterations = 10_000;

        console.log('');
        console.log('    ┌────────────────────────┬───────────────┬───────────────┬──────────┐');
        console.log('    │ Result Set Size         │ Old (ops/sec) │ New (ops/sec) │ Speedup  │');
        console.log('    ├────────────────────────┼───────────────┼───────────────┼──────────┤');

        for (const size of sizes) {
            const input = buildUpdateInput(size);

            const oldTime = benchmarkFn(() => oldGetStateSet(input), iterations);
            const newTime = benchmarkFn(() => getStateSet(input), iterations);

            const oldOps = Math.round(iterations / (oldTime / 1000));
            const newOps = Math.round(iterations / (newTime / 1000));
            const speedup = ((oldTime - newTime) / oldTime * 100).toFixed(1);

            console.log(
                `    │ ${String(size).padEnd(22)} │ ${oldOps.toLocaleString().padStart(13)} │ ${newOps.toLocaleString().padStart(13)} │ ${(speedup + '%').padStart(8)} │`
            );
        }

        console.log('    └────────────────────────┴───────────────┴───────────────┴──────────┘');
    });
});
