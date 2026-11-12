import * as assert from 'assert';

import { Human } from '../../src/truth-table-generator/types.js';
import { oneThatWasCrashing } from '../../src/truth-table-generator/procedures.js';
import { generateTruthTable, getNextWorkingAction } from '../../src/truth-table-generator/index.js';
import { orderedActionList } from '../../src/actions/index.js';
import { StateResolveFunctionInput, MongoQuery } from '../../src/types/index.js';
import { calculateActionFromMap } from '../../src/index.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';
import { applyChangeEvent } from '../../src/truth-table-generator/database/index.js';

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

            const collection = mingoCollectionCreator();
            for (const changeEvent of procedures[0]) {
                const resultsBefore: Human[] = await collection.query(query);
                const keyDocumentMap = new Map();
                resultsBefore.forEach(d => keyDocumentMap.set(d._id, d));
                applyChangeEvent(
                    collection,
                    changeEvent
                );

                const input: StateResolveFunctionInput<Human> = {
                    previousResults: resultsBefore,
                    queryParams: collection.getQueryParams(query),
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
    describe('.getNextWorkingAction()', () => {
        const insertDoc: Human = { _id: 'a', name: 'alice', gender: 'f', age: 1 };
        const input: StateResolveFunctionInput<Human> = {
            previousResults: [],
            queryParams: mingoCollectionCreator().getQueryParams({ selector: {}, sort: ['_id'] }),
            changeEvent: { operation: 'INSERT', id: 'a', doc: insertDoc, previous: null }
        };
        it('should return the first action that calculates the results', () => {
            const actionId = getNextWorkingAction(input, [insertDoc], 0);
            assert.strictEqual(orderedActionList[actionId], 'insertFirst');
        });
        it('should not go on after the last action', () => {
            assert.throws(
                () => getNextWorkingAction(input, [insertDoc], orderedActionList.length),
                { message: 'this should never happen' }
            );
        });
    });
});
