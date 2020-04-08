import { randomString, performanceNow, clone } from 'async-test-util';
import { ChangeEvent, QueryParams } from 'event-reduce-js';

import PouchDb from 'pouchdb-core';
import PouchFind from 'pouchdb-find';
import PouchIdb from 'pouchdb-adapter-indexeddb';
import PouchMem from 'pouchdb-adapter-memory';

PouchDb.plugin(PouchFind as any);
PouchDb.plugin(PouchIdb as any);
PouchDb.plugin(PouchMem as any);

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
            'memory'
        ];
    }
    async init(storageOption: string): Promise<void> {
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
        return [{
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
        }];
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