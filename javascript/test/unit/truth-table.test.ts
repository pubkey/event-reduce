import * as assert from 'assert';
import {
    flagNonRelevant
} from '../../src/logic-generator/truth-table';
import { objectToMap, mapToObject } from '../../src/util';
import { StateSet, StateSetToActionMap, ActionName } from '../../src/types';
describe('truth-table.test.ts', () => {
    it('should have flagged the index char', async () => {
        const table = objectToMap<string, string>({
            '000': 'a',
            '001': 'a',
            '010': 'a',
            '011': 'a',
            '100': 'a',
            '101': 'a',
            '110': 'a',
            '111': 'a'
        });
        const flagged = flagNonRelevant(table, 2);
        const obj = mapToObject(flagged);

        assert.deepStrictEqual(
            obj,
            {
                '00-': 'a',
                '01-': 'a',
                '10-': 'a',
                '11-': 'a'
            }
        );

        // next char
        const flagged2 = flagNonRelevant(flagged, 1);
        const obj2 = mapToObject(flagged2);

        assert.deepStrictEqual(
            obj2,
            {
                '1--': 'a',
                '0--': 'a'
            }
        );

        // next char
        const flagged3 = flagNonRelevant(flagged2, 0);
        const obj3 = mapToObject(flagged3);

        assert.deepStrictEqual(
            obj3,
            {
                '---': 'a'
            }
        );
    });
    it('should have correct results with two actions', () => {
        console.log('1-'.repeat(22));
        console.log('-'.repeat(22));
        console.log('-'.repeat(22));

        const table = objectToMap<string, string>({
            '000': 'a',
            '001': 'a',
            '010': 'b',
            '011': 'a',
            '100': 'a',
            '101': 'b',
            '110': 'a',
            '111': 'a'
        });
        const flagged = flagNonRelevant(table, 2, false);
        const obj = mapToObject(flagged);

        console.dir(obj);

        assert.deepStrictEqual(
            obj,
            {
                '100': 'a',
                '101': 'b',
                '11-': 'a',
                '00-': 'a',
                '010': 'b',
                '011': 'a'
            }
        );

        // next char
        const flagged2 = flagNonRelevant(flagged, 1);
        const obj2 = mapToObject(flagged2);

        assert.deepStrictEqual(
            obj2,
            {
                '100': 'a',
                '101': 'b',
                '11-': 'a',
                '00-': 'a',
                '010': 'b',
                '011': 'a'
            }
        );
    });
});
