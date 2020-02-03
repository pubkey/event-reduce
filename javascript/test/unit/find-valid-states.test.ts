import * as assert from 'assert';

import {
    findValidStates
} from '../../src/logic-generator/find-valid-states';
import { getQueryVariations } from '../../src/logic-generator/queries';
import { getTestProcedures, insertChangeAndCleanup } from '../../src/logic-generator/test-procedures';
import { MongoQuery } from '../../src/logic-generator/types';

describe('find-valid-states.test.ts', () => {
    it('should find some states', async () => {
        const queryVarations: MongoQuery[] = [
            getQueryVariations()[0],
            getQueryVariations()[1],
            getQueryVariations()[2]
        ];
        const states = await findValidStates(
            queryVarations,
            [
                insertChangeAndCleanup()
            ]
        );
        assert.ok(states.size > 10);

        // overwriting previous=UNKNOWN_VALUE should produce more states
        const statesUnknownPrevious = await findValidStates(
            queryVarations,
            [
                insertChangeAndCleanup(true)
            ]
        );
        const merged = new Set([...states, ...statesUnknownPrevious]);
        assert.ok(merged.size > states.size);
    });
});
