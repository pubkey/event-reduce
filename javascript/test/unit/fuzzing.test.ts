import * as assert from 'assert';

import { fuzzing } from '../../src/logic-generator/fuzzing';
import { StateSetToActionMap } from '../../src/types';

describe('fuzzing.test.ts', () => {
    it('should have no error on runFullQueryAgain', async () => {
        const map: StateSetToActionMap = new Map();
        map.get = () => 'runFullQueryAgain';
        const result = await fuzzing(
            map,
            10,
            10
        );
        assert.ok(result.correct);
    });
    it('should have never be correct on doNothing', async () => {
        const map: StateSetToActionMap = new Map();
        map.get = () => 'doNothing';
        const result = await fuzzing(
            map,
            10,
            10
        );
        assert.strictEqual(result.correct, false);
    });
});
