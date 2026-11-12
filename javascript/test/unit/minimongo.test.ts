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
    it('should sort descending when the sort field starts with a minus', () => {
        const collection = mingoCollectionCreator();
        // ids are in the opposite order of the ages
        collection.upsert(randomHuman({ _id: 'a', age: 1 }));
        collection.upsert(randomHuman({ _id: 'b', age: 5 }));
        collection.upsert(randomHuman({ _id: 'c', age: 3 }));
        collection.upsert(randomHuman({ _id: 'd', age: 3 }));

        const descending = collection.query({ selector: {}, sort: ['-age', '_id'] });
        assert.deepStrictEqual(descending.map(d => d._id), ['b', 'c', 'd', 'a']);

        const ascending = collection.query({ selector: {}, sort: ['age', '_id'] });
        assert.deepStrictEqual(ascending.map(d => d._id), ['a', 'c', 'd', 'b']);
    });
    it('the sort fields of the query params should not contain the minus', () => {
        const collection = mingoCollectionCreator();
        const queryParams = collection.getQueryParams({ selector: {}, sort: ['-age', '_id'] });
        assert.deepStrictEqual(queryParams.sortFields, ['age', '_id']);
        const young = randomHuman({ _id: 'a', age: 1 });
        const old = randomHuman({ _id: 'b', age: 5 });
        assert.strictEqual(queryParams.sortComparator(old, young), -1);
        assert.strictEqual(queryParams.sortComparator(young, old), 1);
    });
});
