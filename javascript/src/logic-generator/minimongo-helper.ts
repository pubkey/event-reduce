import {
    MemoryDb,
    MinimongoCollection
} from 'minimongo';
import {
    randomString
} from 'async-test-util';
import { Human, MongoQuery } from './types';
import { ChangeEvent, QueryParams } from '../types';
import { getSortFieldsOfQuery } from '../util';
import {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';

export {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';

export function getMinimongoCollection(): MinimongoCollection<Human> {
    const db: MemoryDb = new MemoryDb();
    const collectionName = randomString(12);
    db.addCollection(collectionName);
    const collection: MinimongoCollection<Human> = db.collections[collectionName];
    return collection;
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
    await new Promise(
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
                limit: query.limit ? query.limit : undefined
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
    const sort = query.sort ? query.sort : [];
    return {
        primaryKey: '_id',
        sortFields: getSortFieldsOfQuery(query),
        skip: query.skip ? query.skip : undefined,
        limit: query.limit ? query.limit : undefined,
        queryMatcher: compileDocumentSelector(query.selector),
        sortComparator: compileSort(sort)
    };
}
