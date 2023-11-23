import * as assert from 'assert';

import {
    randomHuman,
    randomHumans
} from '../../src/truth-table-generator/data-generator.js';

import { clone } from 'async-test-util';
import { MongoQuery } from '../../src/index.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';

/**
 * sometimes we think stuff is wrong with minimongo
 * so we add tests to pin the correct behavior
 */
describe('minimongo.test.ts', () => {
    it('upsert does not affect sort order', async () => {
        const collection = mingoCollectionCreator();

        const addHumans = new Array(5).fill(0)
            .map(() => randomHuman());
        await Promise.all(
            addHumans.map(human => collection.upsert(
                human
            ))
        );
        const query: MongoQuery = {
            selector: {},
            limit: 5,
            sort: ['age']
        };
        const results = await collection.query(
            query
        );
        assert.ok(results[0].age <= results[1].age);

        // change one
        const changeHuman = clone(results[2]);
        changeHuman.age = 0;
        await collection.upsert(
            changeHuman
        );

        const results2 = await collection.query(
            query
        );
        assert.strictEqual(results2[0].age, 0);
    });
});
