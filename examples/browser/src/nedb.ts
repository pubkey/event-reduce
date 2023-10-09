import {
    Human,
    MongoQuery,
    DatabaseImplementation
} from './types';
export {
    compileDocumentSelector,
    compileSort
} from 'minimongo/lib/selector';
import {
    ChangeEvent,
    QueryParams
} from 'event-reduce-js';
import { randomString, performanceNow } from 'async-test-util';
import { getQueryParamsByMongoQuery } from './minimongo';

export function mangoSortToMongoSort(query: MongoQuery) {
    const ret: any = {};
    if (!query.sort) {
        return ret;
    }
    query.sort.forEach(fieldObj => {
        if (typeof fieldObj === 'string') {
            // pouchdb sorting with strings
            if (fieldObj.startsWith('-')) {
                // desc
                ret[fieldObj.substr(1)] = -1;
            } else {
                // asc
                ret[fieldObj] = 1;
            }
        } else {
            const k = Object.keys(fieldObj)[0];
            const v = Object.values(fieldObj)[0];
            const directionNr = v === 'asc' ? 1 : -1;
            ret[k] = directionNr;
        }
    });
    return ret;
}

const Datastore = require('nedb');

export class NeDbImplementation implements DatabaseImplementation<MongoQuery> {
    private col: any;

    getName() {
        return 'nedb';
    }

    getStorageOptions() {
        return [
            'indexeddb',
            'memory'
        ];
    }

    async init(storageOption: string) {
        const dbName = randomString(12);
        if (storageOption === 'memory') {
            this.col = new Datastore();
        } else {
            this.col = new Datastore({
                filename: dbName
            });
        }
        await this.col.loadDatabase();

        await new Promise<void>(res => {
            this.col.ensureIndex({ fieldName: '_id' }, function (_err) {
                res();
            });
        });
    }

    getExampleQueries(): MongoQuery[] {
        return [
            {
                selector: {
                    age: {
                        $gt: 18
                    },
                    gender: 'm'
                },
                limit: 10,
                sort: ['name', '_id']
            },
            {
                selector: {
                    gender: 'f'
                },
                skip: 5,
                limit: 10,
                sort: ['-age', '_id']
            }
        ];
    }
    getQueryParams(query: MongoQuery): QueryParams<any> {
        return getQueryParamsByMongoQuery(query);
    }
    getRawResults(query: MongoQuery): Promise<Human[]> {
        const queryObj = this.col
            .find(query.selector)
            .skip(query.skip)
            .limit(query.limit)
            .sort(mangoSortToMongoSort(query));
        return new Promise(res => {
            queryObj.exec((err, docs) => {
                res(docs);
            });
        }) as any;
    }
    getAll() {
        return new Promise(res => {
            this.col.find({}, (err, docs) => {
                res(docs);
            });
        }) as any;
    }
    async handleEvent(changeEvent: ChangeEvent<Human>): Promise<number> {
        const startTime = performanceNow();

        switch (changeEvent.operation) {
            case 'INSERT':
                await new Promise<void>(res => {
                    this.col.insert(changeEvent.doc, () => res());
                });
                break;
            case 'UPDATE':
                await new Promise<void>(res => {
                    this.col.update(
                        {
                            _id: changeEvent.id
                        },
                        changeEvent.doc,
                        () => res()
                    );
                });
                break;
            case 'DELETE':
                await new Promise<void>(res => {
                    this.col.remove(
                        {
                            _id: changeEvent.id
                        },
                        () => res()
                    );
                });
                break;

        }

        const endTime = performanceNow();
        return endTime - startTime;
    }
}
