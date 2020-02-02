import * as assert from 'assert';
import {
    testResults
} from '../../src/logic-generator/test-results';
import {
    allQueries, findAllQuery
} from '../../src/logic-generator/queries';
import { minimongoFind } from '../../src/logic-generator/minimongo-helper';
describe('test-results.test.ts', () => {
    it('should always be correct on empty state-action-map', async () => {
        const res = await testResults(
            allQueries,
            100,
            new Map()
        );
        assert.ok(res.correct);
        const allDocs = await minimongoFind(res.collection, findAllQuery);
        assert.ok(allDocs.length > 3);
    });
    it('should always be non-correct in an hacked state-action-map', async () => {
        const hackedMap = new Map();
        hackedMap.get = () => 'doNothing';

        const res = await testResults(
            allQueries,
            100,
            hackedMap
        );
        assert.ok(!res.correct);
    });
});
