import * as assert from 'assert';

import { fuzzing } from '../../src/truth-table-generator/fuzzing.js';
import { orderedActionList } from '../../src/actions/index.js';
import { StateActionIdMap } from '../../src/truth-table-generator/types.js';

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
    it('should have never be correct on doNothing', async () => {
        const map: StateActionIdMap = new Map();
        map.get = () => indexOfDoNothing;
        const result = await fuzzing(
            map,
            10,
            10
        );
        assert.strictEqual(result.ok, false);
    });
});
