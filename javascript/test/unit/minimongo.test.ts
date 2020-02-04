import * as assert from 'assert';

import {
    randomHuman
} from '../../src/logic-generator/data-generator';

import {
    getMinimongoCollection,
    minimongoUpsert,
    minimongoFind
} from '../../src/logic-generator/minimongo-helper';
import { MongoQuery } from '../../src/logic-generator/types';
import { clone } from 'async-test-util';

/**
 * sometimes we think stuff is wrong with minimongo
 * so we add tests to pin the correct behavior
 */
describe('minimongo.test.ts', () => {
    it('upsert does not affect sort order', async () => {
        const collection = getMinimongoCollection();

        const addHumans = new Array(5).fill(0)
            .map(() => randomHuman());
        await Promise.all(
            addHumans.map(human => minimongoUpsert(
                collection,
                human
            ))
        );
        const query: MongoQuery = {
            selector: {},
            limit: 5,
            sort: ['age']
        };
        const results = await minimongoFind(
            collection,
            query
        );
        assert.ok(results[0].age < results[1].age);

        // change one
        const changeHuman = clone(results[2]);
        changeHuman.age = 0;
        await minimongoUpsert(
            collection,
            changeHuman
        );

        const results2 = await minimongoFind(
            collection,
            query
        );
        assert.strictEqual(results2[0].age, 0);
    });
});
