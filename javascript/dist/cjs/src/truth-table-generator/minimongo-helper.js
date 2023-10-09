"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQueryParamsByMongoQuery = exports.applyChangeEvent = exports.minimongoFind = exports.minimongoRemove = exports.minimongoUpsert = exports.getMinimongoCollection = exports.compileSort = exports.compileDocumentSelector = void 0;
const minimongo_1 = require("minimongo");
const selector_js_1 = require("minimongo/lib/selector.js");
var selector_js_2 = require("minimongo/lib/selector.js");
Object.defineProperty(exports, "compileDocumentSelector", { enumerable: true, get: function () { return selector_js_2.compileDocumentSelector; } });
Object.defineProperty(exports, "compileSort", { enumerable: true, get: function () { return selector_js_2.compileSort; } });
const async_test_util_1 = require("async-test-util");
const util_js_1 = require("../util.js");
function getMinimongoCollection() {
    const db = new minimongo_1.MemoryDb();
    const collectionName = (0, async_test_util_1.randomString)(12);
    db.addCollection(collectionName);
    const collection = db.collections[collectionName];
    return collection;
}
exports.getMinimongoCollection = getMinimongoCollection;
async function minimongoUpsert(collection, doc) {
    await new Promise((resolve, reject) => collection.upsert(doc, resolve, reject));
}
exports.minimongoUpsert = minimongoUpsert;
async function minimongoRemove(collection, id) {
    await new Promise((resolve, reject) => collection.remove(id, resolve, reject));
}
exports.minimongoRemove = minimongoRemove;
function minimongoFind(collection, query) {
    return new Promise((resolve, reject) => collection.find(query.selector, {
        skip: query.skip ? query.skip : undefined,
        limit: query.limit ? query.limit : undefined,
        sort: query.sort ? query.sort : ['_id'] // by default it sorts by primary
    }).fetch(resolve, reject));
}
exports.minimongoFind = minimongoFind;
async function applyChangeEvent(collection, changeEvent) {
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
exports.applyChangeEvent = applyChangeEvent;
function getQueryParamsByMongoQuery(query) {
    const sort = query.sort ? query.sort : [];
    // ensure primary is in sort so we have a predictable query
    if (!(sort.includes('_id') || sort.includes('-_id'))) {
        throw new Error('MongoQueries must have a predictable sorting');
    }
    const nonDeterministicSort = (0, selector_js_1.compileSort)(sort);
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
        sortFields: (0, util_js_1.getSortFieldsOfQuery)(query),
        skip: query.skip ? query.skip : undefined,
        limit: query.limit ? query.limit : undefined,
        queryMatcher: (0, selector_js_1.compileDocumentSelector)(query.selector),
        sortComparator: deterministicSort
    };
}
exports.getQueryParamsByMongoQuery = getQueryParamsByMongoQuery;
//# sourceMappingURL=minimongo-helper.js.map