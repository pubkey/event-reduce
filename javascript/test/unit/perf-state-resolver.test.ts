import * as assert from 'assert';
import {
    getStateSet,
    stateResolveFunctions
} from '../../src/states/index.js';
import { getExampleStateResolveFunctionInput } from '../helper/input.js';
import { StateResolveFunctionInput, StateName } from '../../src/types/index.js';
import { randomHuman } from '../../src/truth-table-generator/data-generator.js';
import { Human } from '../../src/truth-table-generator/types.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';

const pseudoCollection = mingoCollectionCreator();

describe('perf-state-resolver.test.ts', () => {
    function buildUpdateInput(resultsCount: number): StateResolveFunctionInput<Human> {
        const previous = randomHuman();
        const doc = { ...previous, age: previous.age + 10 };
        const results: Human[] = [];
        for (let i = 0; i < resultsCount; i++) {
            results.push(randomHuman());
        }
        // Ensure the changed doc is in results
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

    function buildInsertInput(resultsCount: number): StateResolveFunctionInput<Human> {
        const doc = randomHuman();
        const results: Human[] = [];
        for (let i = 0; i < resultsCount; i++) {
            results.push(randomHuman());
        }

        return {
            changeEvent: {
                operation: 'INSERT',
                doc,
                previous: null,
                id: doc._id
            },
            previousResults: results,
            queryParams: pseudoCollection.getQueryParams({
                selector: { age: { $gt: 10 } },
                sort: ['age', '_id'],
                limit: resultsCount + 5
            })
        };
    }

    it('should complete getStateSet within performance budget', () => {
        const input = buildUpdateInput(100);

        // Warm up
        for (let i = 0; i < 100; i++) {
            getStateSet(input);
        }

        const iterations = 10_000;
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            getStateSet(input);
        }
        const elapsed = performance.now() - start;
        const opsPerSec = Math.round(iterations / (elapsed / 1000));

        console.log(`    getStateSet (UPDATE, 100 results): ${opsPerSec.toLocaleString()} ops/sec (${(elapsed / iterations).toFixed(4)}ms per call)`);
        assert.ok(opsPerSec > 10_000, 'getStateSet should exceed 10k ops/sec');
    });

    it('should complete individual state functions quickly', () => {
        const input = buildUpdateInput(100);
        const iterations = 50_000;

        // Warm up
        const names = Object.keys(stateResolveFunctions) as StateName[];
        for (const name of names) {
            for (let i = 0; i < 100; i++) {
                stateResolveFunctions[name](input);
            }
        }

        const timings: { name: string; opsPerSec: number }[] = [];

        for (const name of names) {
            const fn = stateResolveFunctions[name];
            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                fn(input);
            }
            const elapsed = performance.now() - start;
            const opsPerSec = Math.round(iterations / (elapsed / 1000));
            timings.push({ name, opsPerSec });
        }

        console.log('\n    Individual state function performance (50k iterations):');
        for (const t of timings) {
            console.log(`      ${t.name.padEnd(25)} ${t.opsPerSec.toLocaleString().padStart(15)} ops/sec`);
        }

        // All functions should exceed a minimum throughput
        for (const t of timings) {
            assert.ok(
                t.opsPerSec > 100_000,
                `${t.name} should exceed 100k ops/sec, got ${t.opsPerSec}`
            );
        }
    });

    it('should complete getStateSet for INSERT operations quickly', () => {
        const input = buildInsertInput(100);

        // Warm up
        for (let i = 0; i < 100; i++) {
            getStateSet(input);
        }

        const iterations = 10_000;
        const start = performance.now();
        for (let i = 0; i < iterations; i++) {
            getStateSet(input);
        }
        const elapsed = performance.now() - start;
        const opsPerSec = Math.round(iterations / (elapsed / 1000));

        console.log(`    getStateSet (INSERT, 100 results): ${opsPerSec.toLocaleString()} ops/sec (${(elapsed / iterations).toFixed(4)}ms per call)`);
        assert.ok(opsPerSec > 10_000, 'getStateSet should exceed 10k ops/sec');
    });

    it('should scale well with large result sets', () => {
        const smallInput = buildUpdateInput(10);
        const largeInput = buildUpdateInput(1000);

        // Warm up
        for (let i = 0; i < 100; i++) {
            getStateSet(smallInput);
            getStateSet(largeInput);
        }

        const iterations = 5_000;

        const startSmall = performance.now();
        for (let i = 0; i < iterations; i++) {
            getStateSet(smallInput);
        }
        const elapsedSmall = performance.now() - startSmall;

        const startLarge = performance.now();
        for (let i = 0; i < iterations; i++) {
            getStateSet(largeInput);
        }
        const elapsedLarge = performance.now() - startLarge;

        const smallOps = Math.round(iterations / (elapsedSmall / 1000));
        const largeOps = Math.round(iterations / (elapsedLarge / 1000));

        console.log(`    getStateSet (10 results):   ${smallOps.toLocaleString()} ops/sec`);
        console.log(`    getStateSet (1000 results): ${largeOps.toLocaleString()} ops/sec`);

        // With keyDocumentMap, large result sets shouldn't be dramatically slower
        // (wasInResult uses Map.has() instead of linear scan)
        assert.ok(smallOps > 10_000, 'small result set should exceed 10k ops/sec');
        assert.ok(largeOps > 5_000, 'large result set should exceed 5k ops/sec');
    });
});
