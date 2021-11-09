import { randomString, performanceNow } from 'async-test-util';
import { ChangeEvent, QueryParams } from 'event-reduce-js';

const PouchDb = require('pouchdb-core').default;
const PouchFind = require('pouchdb-find').default;
const PouchIndexedDb = require('pouchdb-adapter-indexeddb').default;
const PouchIdb = require('pouchdb-adapter-idb').default;
const PouchMem = require('pouchdb-adapter-memory').default;

import {
    DatabaseImplementation,
    MongoQuery,
    Human
} from './types';
import { getQueryParamsByMongoQuery } from './minimongo';


export class PouchDbImplementation implements DatabaseImplementation<MongoQuery> {
    private col: any;

    getName(): string {
        return 'pouchdb';
    }
    getStorageOptions(): string[] {
        return [
            'indexeddb',
            'memory',
            // 'idb' // old pouchdb indexeddb adapter (about half as fast)
        ];
    }
    async init(storageOption: string): Promise<void> {
        PouchDb.plugin(PouchFind as any);
        PouchDb.plugin(PouchIndexedDb as any);
        PouchDb.plugin(PouchIdb as any);
        PouchDb.plugin(PouchMem as any);

        const dbName = randomString(12);
        this.col = new PouchDb(
            dbName,
            {
                adapter: storageOption
            }
        );
        // await info call to ensure db is ready
        await this.col.info();

        // create indexes
        await Promise.all(
            [
                'name',
                'gender',
                'age'
            ].map(field => this.col.createIndex({
                index: {
                    fields: [field]
                }
            }))
        );

        await this.col.info();

    }
    getExampleQueries(): MongoQuery[] {
        return [
            {
                selector: {
                    age: {
                        $gt: 18
                    },
                    gender: 'm',
                    name: {
                        $gt: null
                    }
                },
                limit: 10,
                sort: ['name']
            },
            {
                selector: {
                    gender: 'f'
                },
                skip: 5,
                limit: 10,
                sort: ['-age']
            }
        ];
    }
    getQueryParams(query: MongoQuery): QueryParams<any> {
        return getQueryParamsByMongoQuery(query);
    }
    async getRawResults(query: MongoQuery): Promise<Human[]> {
        const res = await this.col.find(query);
        return res.docs;
    }
    async getAll(): Promise<Human[]> {
        const ret = await this.getRawResults({
            selector: {
            },
            sort: ['_id']
        });
        return ret;
    }
    async handleEvent(changeEvent: ChangeEvent<Human>): Promise<number> {
        const startTime = performanceNow();

        switch (changeEvent.operation) {
            case 'INSERT':
                await this.col.put(changeEvent.doc);
                break;
            case 'UPDATE':
                // get doc for last revision
                const doc = await this.col.get(changeEvent.id);
                const putDoc = Object.assign(
                    changeEvent.doc,
                    {
                        _rev: doc._rev
                    });
                await this.col.put(putDoc);
                break;
            case 'DELETE':
                // get doc for last revision
                const doc2 = await this.col.get(changeEvent.id);
                const putDoc2 = Object.assign(
                    changeEvent.previous,
                    {
                        _rev: doc2._rev
                    });
                await this.col.remove(putDoc2);
                break;

        }

        const endTime = performanceNow();
        return endTime - startTime;
    }

}
