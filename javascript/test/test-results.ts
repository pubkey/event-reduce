import { QueryParams, ResultKeyDocumentMap } from "../src/types";
import {
    Human,
    MongoQuery
} from "./helper/types";

import {
    MemoryDb,
    MinimongoCollection
} from 'minimongo';

import {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';
import { randomWrite } from "./helper/data-generator";
import { calculateAction } from "../src";

const COLLECTION_NAME = 'humans';

export type UseQuery = {
    query: MongoQuery,
    queryParams: QueryParams<Human>,
    results: Human[],
    resultKeyDocumentMap: ResultKeyDocumentMap<Human>
};

/**
 * runs many changes over the database
 * and checks after each change if the calculated results
 * are equal to the result of the query.
 */
export async function testResults(
    queries: MongoQuery[],
    writesAmount: number = 100
) {
    const db: MemoryDb = new MemoryDb();
    db.addCollection(COLLECTION_NAME);
    const collection: MinimongoCollection<Human> = db.collections[COLLECTION_NAME];

    const useQueries: UseQuery[] = queries.map(query => {
        return {
            query,
            queryParams: {
                primaryKey: '_id',
                sortFields: [], // TODO https://github.com/pubkey/rxdb/blob/master/src/query-change-detector.ts#L289
                skip: query.skip ? query.skip : undefined,
                limit: query.limit ? query.limit : undefined,
                queryMatcher: compileDocumentSelector(query.selector),
                sortComparator: compileSort(query.sort)
            },
            results: [],
            resultKeyDocumentMap: new Map()
        };
    });

    let allDocs: Human[] = [];
    while (writesAmount > 0) {

        // make change to database
        const write = randomWrite(allDocs);
        switch (write.op) {
            case 'INSERT':
                await new Promise(
                    (resolve, reject) => collection.upsert(write.doc, resolve, reject)
                );
                break;
            case 'UPDATE':
                await new Promise(
                    (resolve, reject) => collection.upsert(write.doc, resolve, reject)
                );
                break;
            case 'DELETE':
                await new Promise(
                    (resolve, reject) => collection.remove(write._id, resolve, reject)
                );
                break;
        }

        // update allDocs
        allDocs = await new Promise(
            (resolve, reject) => collection.find({}).fetch(resolve, reject)
        );

        // check if results matches for each query
        for (let i = 0; i < useQueries.length; i++) {
            const query: UseQuery = useQueries[i];
            const resultsFromExecute = await new Promise(
                (resolve, reject) => collection.find(query.query).fetch(resolve, reject)
            );

            const action = calculateAction(
                query.queryParams,
                {},
                query.results,
                query.resultKeyDocumentMap
            );

            // TODO continue here
        }
    }

}