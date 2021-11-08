import {
    MemoryDb,
    MinimongoCollection
} from 'minimongo';
import {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';
export {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';
import {
    randomString
} from 'async-test-util';

import type { Human } from './types';
import type {
    ChangeEvent,
    QueryParams,
    MongoQuery,
    DeterministicSortComparator
} from '../types';
import { getSortFieldsOfQuery } from '../util';

export function getMinimongoCollection<DocType = Human>(): MinimongoCollection<DocType> {
    const db: MemoryDb = new MemoryDb();
    const collectionName = randomString(12);
    db.addCollection(collectionName);
    const collection: MinimongoCollection<DocType> = db.collections[collectionName];
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
        (resolve, reject) => collection.remove(id, resolve as any, reject)
    );
}

export function minimongoFind<DocType>(
    collection: MinimongoCollection<DocType>,
    query: MongoQuery
): Promise<DocType[]> {
    return new Promise(
        (resolve, reject) => collection.find(
            query.selector,
            {
                skip: query.skip ? query.skip : undefined,
                limit: query.limit ? query.limit : undefined,
                sort: query.sort ? query.sort : ['_id'] // by default it sorts by primary
            }
        ).fetch(resolve, reject)
    );
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

export function getQueryParamsByMongoQuery<DocType>(query: MongoQuery<DocType>): QueryParams<DocType> {
    const sort = query.sort ? query.sort : [];

    // ensure primary is in sort so we have a predictable query
    if (!(sort.includes('_id') || sort.includes('-_id'))) {
        throw new Error('MongoQueries must have a predictable sorting');
    }

    const nonDeterministicSort = compileSort(sort);
    const deterministicSort: DeterministicSortComparator<DocType> = (a: DocType, b: DocType) => {
        const result = nonDeterministicSort(a, b);
        if (result === 0) {
            throw new Error('sort would output a non-deterministic order');
        } else {
            return result;
        }
    };

    return {
        primaryKey: '_id',
        sortFields: getSortFieldsOfQuery(query),
        skip: query.skip ? query.skip : undefined,
        limit: query.limit ? query.limit : undefined,
        queryMatcher: compileDocumentSelector(query.selector),
        sortComparator: deterministicSort
    };
}
