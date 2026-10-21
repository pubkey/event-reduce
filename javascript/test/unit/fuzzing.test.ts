import * as assert from 'assert';

import {
    fuzzing,
    doesProcedureFail,
    makeProcedureConsistent
} from '../../src/truth-table-generator/fuzzing.js';
import { doesActionWork } from '../../src/truth-table-generator/index.js';
import { orderedActionList, actionFunctions } from '../../src/actions/index.js';
import { StateActionIdMap, Human } from '../../src/truth-table-generator/types.js';
import { randomHuman } from '../../src/truth-table-generator/data-generator.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';

describe('fuzzing.test.ts', () => {

    const indexOfRunAgain = orderedActionList.indexOf('runFullQueryAgain');
    const indexOfDoNothing = orderedActionList.indexOf('doNothing');

    it('should have no error on runFullQueryAgain', async () => {
        const map: StateActionIdMap = new Map();
        map.get = () => indexOfRunAgain;
        const result = await fuzzing(
            map,
            10,
            10
        );
        assert.strictEqual(result.ok, true);
    });
    it('should find the error of a wrong table and shrink the procedure', () => {
        const map: StateActionIdMap = new Map();
        map.get = () => indexOfDoNothing;
        const result = fuzzing(
            map,
            10,
            60
        );
        assert.strictEqual(result.ok, false);
        assert.ok(doesProcedureFail(map, result.query, result.procedure));
        // it cannot be shrunk any further: without any one of the events, it does not fail anymore
        result.procedure.forEach((_event, index) => {
            const without = makeProcedureConsistent(
                result.procedure.filter((_e, i) => i !== index)
            );
            assert.strictEqual(doesProcedureFail(map, result.query, without), false);
        });
    });
    it('doesActionWork() should find wrong handling of the keyDocumentMap', () => {
        const insertMe = randomHuman();
        const input = {
            previousResults: [] as Human[],
            changeEvent: {
                operation: 'INSERT' as const,
                id: insertMe._id,
                doc: insertMe,
                previous: null
            },
            queryParams: mingoCollectionCreator().getQueryParams({
                selector: {},
                sort: ['_id']
            })
        };
        assert.ok(doesActionWork(input, [insertMe], 'insertFirst'));

        const original = actionFunctions.insertFirst;
        // results are correct but the keyDocumentMap is not updated
        actionFunctions.insertFirst = (i) => {
            i.previousResults.unshift(i.changeEvent.doc);
        };
        try {
            assert.strictEqual(doesActionWork(input, [insertMe], 'insertFirst'), false);
        } finally {
            actionFunctions.insertFirst = original;
        }
    });
});
