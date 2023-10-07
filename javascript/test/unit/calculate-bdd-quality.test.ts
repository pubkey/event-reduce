import * as assert from 'assert';
import {
    createBddFromTruthTable,
    fillTruthTable
} from 'binary-decision-diagram';

import {
    measurePerformanceOfStateFunctions,
    countFunctionUsages,
    getQualityOfBdd
} from '../../src/truth-table-generator/calculate-bdd-quality.js';
import {
    orderedStateList
} from '../../src/states/index.js';
import { StateActionIdMap } from '../../src/truth-table-generator/types.js';
import { OUTPUT_TRUTH_TABLE_PATH } from '../../src/truth-table-generator/config.js';
import { readJsonFile } from '../../src/truth-table-generator/util.js';
import { objectToMap } from '../../src/index.js';
import { orderedActionList } from '../../src/actions/index.js';
import {
    DEFAULT_EXAMPLE_QUERY
} from '../../src/truth-table-generator/queries.js';
import {
    insertFiveSorted
} from '../../src/truth-table-generator/procedures.js';

describe('calculate-bdd-quality.test.ts', () => {
    const unknownValueActionId: number = 42;
    const truthTable: StateActionIdMap = objectToMap(
        readJsonFile(OUTPUT_TRUTH_TABLE_PATH)
    );
    const truthTableWithActionName = new Map();
    for (const [key, value] of truthTable.entries()) {
        const actionName = orderedActionList[value];
        truthTableWithActionName.set(key, actionName);
    }
    fillTruthTable(
        truthTable,
        truthTable.keys().next().value.length,
        unknownValueActionId
    );

    describe('.measurePerformanceOfStateFunctions()', () => {
        it('should give valid results', async () => {
            const res = await measurePerformanceOfStateFunctions(10000);
            orderedStateList.forEach(k => {
                assert.ok(res[k]);
                assert.ok(res[k] > 0);
            });
        });
    });
    describe('.countFunctionUsages()', () => {
        it('should have counted at least one', async () => {
            const bdd = createBddFromTruthTable(truthTable);
            const usages = await countFunctionUsages(
                bdd,
                [DEFAULT_EXAMPLE_QUERY],
                [insertFiveSorted()]
            );
            const moreThenOne = Object.values(usages).find(n => n > 0);
            assert.ok(moreThenOne);
        });
    });
    describe('.getQualityOfBdd()', () => {
        it('should get a number', async () => {
            const bdd = createBddFromTruthTable(truthTable);
            const perfMeasurement = await measurePerformanceOfStateFunctions(100);
            const quality = await getQualityOfBdd(
                bdd,
                perfMeasurement,
                [DEFAULT_EXAMPLE_QUERY],
                [insertFiveSorted()]
            );
            assert.strictEqual(typeof quality, 'number');
            assert.ok(quality > 0);
        });
    });
});
