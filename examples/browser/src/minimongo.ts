import {
    MemoryDb,
    MinimongoCollection,
    IndexedDb
} from 'minimongo';
import {
    Human,
    MongoQuery,
    DatabaseImplementation
} from './types';
import {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';
export {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';
import {
    ChangeEvent,
    getSortFieldsOfQuery,
    QueryParams
} from 'event-reduce-js';
import { randomString, performanceNow } from 'async-test-util';

// idb-collection
export async function getMinimongoCollection(storage: 'indexeddb' | 'memory'): Promise<MinimongoCollection<Human>> {
    if (storage === 'memory') {
        const db: MemoryDb = new MemoryDb();
        const collectionName = randomString(12);
        db.addCollection(collectionName);
        const collection: MinimongoCollection<Human> = db.collections[collectionName];
        return collection;
    } else if (storage === 'indexeddb') {
        const db: IndexedDb = await new Promise((res, rej) => {
            const v = new (IndexedDb as any)({ namespace: 'mydb' }, () => {
                res(v);
            }, err => rej(err));
        });
        const col: MinimongoCollection = await new Promise(res => {
            db.addCollection('docs', () => {
                res(db['docs']);
            });
        });
        return col;
    }
}

export async function minimongoUpsert<DocType>(
    collection: MinimongoCollection<DocType>,
    doc: DocType
): Promise<void> {
    await new Promise(
        (resolve, reject) => collection.upsert(doc, resolve, reject)
    );
}

export async function minimongoRemove<DocType>(
    collection: MinimongoCollection<DocType>,
    id: string
): Promise<void> {
    await new Promise<void>(
        (resolve, reject) => collection.remove(id, resolve, reject)
    );
}

export async function minimongoFind<DocType>(
    collection: MinimongoCollection<DocType>,
    query: MongoQuery
): Promise<DocType[]> {
    const results: DocType[] = await new Promise(
        (resolve, reject) => collection.find(
            query.selector,
            {
                skip: query.skip ? query.skip : undefined,
                limit: query.limit ? query.limit : undefined,
                sort: query.sort ? query.sort : ['_id'] // by default it sorts by primary
            }
        ).fetch(resolve, reject)
    );
    return results;
}

export async function applyChangeEvent<DocType>(
    collection: MinimongoCollection<DocType>,
    changeEvent: ChangeEvent<DocType>
): Promise<void> {
    switch (changeEvent.operation) {
        case 'INSERT':
            await minimongoUpsert(
                collection,
                changeEvent.doc
            );
            break;
        case 'UPDATE':
            await minimongoUpsert(
                collection,
                changeEvent.doc
            );
            break;
        case 'DELETE':
            await minimongoRemove(
                collection,
                changeEvent.id
            );
            break;
    }
}

export function getQueryParamsByMongoQuery(query: MongoQuery): QueryParams<any> {
    const sort = query.sort ? query.sort : ['_id'];
    return {
        primaryKey: '_id',
        sortFields: getSortFieldsOfQuery(query),
        skip: query.skip ? query.skip : undefined,
        limit: query.limit ? query.limit : undefined,
        queryMatcher: compileDocumentSelector(query.selector),
        sortComparator: compileSort(sort)
    };
}


export class MiniMongoImplementation implements DatabaseImplementation<MongoQuery> {
    private col: MinimongoCollection;

    getName() {
        return 'minimongo';
    }

    getStorageOptions() {
        return [
            'indexeddb',
            'memory'
        ];
    }

    async init(storageOption: string) {
        this.col = await getMinimongoCollection(storageOption as any);
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
        return minimongoFind(
            this.col,
            query
        );
    }
    getAll() {
        return minimongoFind(
            this.col,
            {
                selector: {},
                sort: ['_id']
            }
        );
    }
    async handleEvent(changeEvent: ChangeEvent<Human>): Promise<number> {
        const startTime = performanceNow();
        await applyChangeEvent(
            this.col,
            changeEvent
        );
        const endTime = performanceNow();
        return endTime - startTime;
    }
}
