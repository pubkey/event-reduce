import * as assert from 'assert';
import {
    testResults
} from '../../src/logic-generator/test-results';
import {
    findAllQuery, getQueryVariations
} from '../../src/logic-generator/queries';
import { minimongoFind } from '../../src/logic-generator/minimongo-helper';
import { getRandomChangeEvents } from '../../src/logic-generator/data-generator';
describe('test-results.test.ts', () => {
    it('should always be correct on empty state-action-map', async () => {
        const useChangeEvents = await getRandomChangeEvents(100);
        const hackedMap = new Map();
        hackedMap.get = () => 'runFullQueryAgain';
        const res = await testResults(
            [
                getQueryVariations()[0],
                getQueryVariations()[1],
                getQueryVariations()[2]
            ],
            hackedMap,
            useChangeEvents,
            false,
            false,
            true
        );
        assert.ok(res.correct);
    });
    it('should always be non-correct in an hacked state-action-map', async () => {
        const useChangeEvents = await getRandomChangeEvents(100);
        const hackedMap = new Map();
        hackedMap.get = () => 'doNothing';

        const res = await testResults(
            [
                getQueryVariations()[0],
                getQueryVariations()[1],
                getQueryVariations()[2]
            ],
            hackedMap,
            useChangeEvents
        );
        assert.ok(!res.correct);
    });
});
