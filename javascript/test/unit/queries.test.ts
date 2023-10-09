import * as assert from 'assert';
import {
    getQueryVariations,
    SELECTOR_VARIATIONS,
    SKIP_VARIATIONS,
    LIMIT_VARIATIONS,
    SORT_VARIATION
} from '../../src/truth-table-generator/queries.js';

describe('queries-state.test.ts', () => {
    it('should have all query variations', () => {
        const queries = getQueryVariations();
        const amount =
            SELECTOR_VARIATIONS.length *
            SKIP_VARIATIONS.length *
            LIMIT_VARIATIONS.length *
            SORT_VARIATION.length;
        assert.ok(queries.length > amount);
    });
    it('should have no duplicates', () => {
        const queries = getQueryVariations();
        const set: Set<string> = new Set();
        queries.forEach(q => {
            const str = JSON.stringify(q);
            if (set.has(str)) {
                throw new Error('query is duplicate: ' + str);
            } else {
                set.add(str);
            }
        });
    });
});
