import { MemoryDb } from 'minimongo';
import { compileDocumentSelector, compileSort } from 'minimongo/lib/selector.js';
export { compileDocumentSelector, compileSort } from 'minimongo/lib/selector.js';
import { randomString } from 'async-test-util';
import { getSortFieldsOfQuery } from '../util.js';
export function getMinimongoCollection() {
    const db = new MemoryDb();
    const collectionName = randomString(12);
    db.addCollection(collectionName);
    const collection = db.collections[collectionName];
    return collection;
}
export async function minimongoUpsert(collection, doc) {
    await new Promise((resolve, reject) => collection.upsert(doc, resolve, reject));
}
export async function minimongoRemove(collection, id) {
    await new Promise((resolve, reject) => collection.remove(id, resolve, reject));
}
export function minimongoFind(collection, query) {
    return new Promise((resolve, reject) => collection.find(query.selector, {
        skip: query.skip ? query.skip : undefined,
        limit: query.limit ? query.limit : undefined,
        sort: query.sort ? query.sort : ['_id'] // by default it sorts by primary
    }).fetch(resolve, reject));
}
export async function applyChangeEvent(collection, changeEvent) {
    switch (changeEvent.operation) {
        case 'INSERT':
            await minimongoUpsert(collection, changeEvent.doc);
            break;
        case 'UPDATE':
            await minimongoUpsert(collection, changeEvent.doc);
            break;
        case 'DELETE':
            await minimongoRemove(collection, changeEvent.id);
            break;
    }
}
export function getQueryParamsByMongoQuery(query) {
    const sort = query.sort ? query.sort : [];
    // ensure primary is in sort so we have a predictable query
    if (!(sort.includes('_id') || sort.includes('-_id'))) {
        throw new Error('MongoQueries must have a predictable sorting');
    }
    const nonDeterministicSort = compileSort(sort);
    const deterministicSort = (a, b) => {
        const result = nonDeterministicSort(a, b);
        if (result === 0) {
            throw new Error('sort would output a non-deterministic order');
        }
        else {
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
//# sourceMappingURL=minimongo-helper.js.map