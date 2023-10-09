import * as assert from 'assert';

import { Human } from '../../src/truth-table-generator/types.js';
import { oneThatWasCrashing } from '../../src/truth-table-generator/procedures.js';
import { generateTruthTable } from '../../src/truth-table-generator/index.js';
import {
    getMinimongoCollection,
    minimongoFind, applyChangeEvent,
    getQueryParamsByMongoQuery
} from '../../src/truth-table-generator/minimongo-helper.js';
import { StateResolveFunctionInput, MongoQuery } from '../../src/types/index.js';
import { calculateActionFromMap } from '../../src/index.js';

/**
 * sometimes we think stuff is wrong with minimongo
 * so we add tests to pin the correct behavior
 */
describe('truth-table-generator.test.ts', () => {
    describe('.generateTruthTable()', () => {
        it('should contain all itterated states', async () => {
            const query: MongoQuery = {
                selector: { gender: 'm' },
                sort: ['age', '_id']
            };
            const procedures = [oneThatWasCrashing()];
            const table = await generateTruthTable({
                queries: [query],
                procedures,
                log: false
            });

            const collection = getMinimongoCollection();
            for (const changeEvent of procedures[0]) {
                const resultsBefore: Human[] = await minimongoFind(collection, query);
                const keyDocumentMap = new Map();
                resultsBefore.forEach(d => keyDocumentMap.set(d._id, d));
                await applyChangeEvent(
                    collection,
                    changeEvent
                );

                const input: StateResolveFunctionInput<Human> = {
                    previousResults: resultsBefore,
                    queryParams: getQueryParamsByMongoQuery(query),
                    keyDocumentMap,
                    changeEvent
                };

                const resultFromMap = calculateActionFromMap(
                    table as any,
                    input
                );
                assert.ok(table.has(resultFromMap.stateSet));
            }
        });
    });
});
