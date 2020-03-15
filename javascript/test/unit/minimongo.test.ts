import * as assert from 'assert';

import {
    randomHuman, randomHumans
} from '../../src/truth-table-generator/data-generator';

import {
    getMinimongoCollection,
    minimongoUpsert,
    minimongoFind,
    compileSort
} from '../../src/truth-table-generator/minimongo-helper';
import { clone } from 'async-test-util';
import { MongoQuery } from '../../src';

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
    it('if all attributes are equal, sort should use _id', async () => {
        const query: MongoQuery = {
            selector: {},
            sort: [
                'age',
                'name',
                '_id'
            ]
        };
        const docs = randomHumans(20, {
            age: 100,
            name: 'alice'
        });
        const comparator = compileSort(query.sort);
        const sortedDocs = docs.sort(comparator);

        const collection = getMinimongoCollection();
        await Promise.all(
            docs.map(human => {
                console.log(human._id);
                minimongoUpsert(
                    collection,
                    human
                );
            })
        );
        const results = await minimongoFind(
            collection,
            query
        );
        assert.deepStrictEqual(sortedDocs, results);
    });
});
