import deepEqual from 'deep-equal';

import {
    QueryParams,
    ResultKeyDocumentMap,
    ChangeEvent,
    StateSetToActionMap
} from '../types';
import {
    Human,
    MongoQuery
} from './types';

import {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';
import {
    randomChangeEvent
} from './data-generator';
import {
    calculateActionFromMap,
    runAction
} from '../';
import {
    getMinimongoCollection, minimongoUpsert, minimongoRemove, minimongoFind
} from './minimongo-helper';
import { findAllQuery } from './queries';
import { getSortFieldsOfQuery } from '../util';

export type UseQuery = {
    query: MongoQuery,
    queryParams: QueryParams<Human>,
    results: Human[],
    resultKeyDocumentMap: ResultKeyDocumentMap<Human>
};

export interface TestResultsReturn {
    correct: boolean;
    handledEvents: ChangeEvent<Human>[];
    useQueries: UseQuery[];
    allDocs: Human[];
}

/**
 * runs many changes over the database
 * and checks after each change if the calculated results
 * are equal to the result of the query.
 */
export async function testResults(
    queries: MongoQuery[],
    writesAmount: number = 100,
    stateSetToActionMap: StateSetToActionMap
): Promise<TestResultsReturn> {
    const collection = getMinimongoCollection();

    const useQueries: UseQuery[] = queries.map(query => {
        const sort = query.sort ? query.sort : [];
        const queryParams: QueryParams<Human> = {
            primaryKey: '_id',
            sortFields: getSortFieldsOfQuery(query),
            skip: query.skip ? query.skip : undefined,
            limit: query.limit ? query.limit : undefined,
            queryMatcher: compileDocumentSelector(query.selector),
            sortComparator: compileSort(sort)
        };
        return {
            query,
            queryParams,
            results: [],
            resultKeyDocumentMap: new Map()
        };
    });

    let allDocs: Human[] = [];
    const handledEvents: ChangeEvent<Human>[] = [];

    while (writesAmount > 0) {
        writesAmount--;

        // make change to database
        const changeEvent = randomChangeEvent(allDocs);
        handledEvents.push(changeEvent);
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



        // update allDocs
        allDocs = await minimongoFind(collection, findAllQuery);

        // check if results matches for each query
        for (let i = 0; i < useQueries.length; i++) {
            const query: UseQuery = useQueries[i];
            const resultsFromExecute = await minimongoFind(collection, query.query);

            const action = calculateActionFromMap(
                stateSetToActionMap,
                query.queryParams,
                changeEvent,
                query.results,
                query.resultKeyDocumentMap
            );

            let calculatedResults: Human[];
            if (action === 'runFullQueryAgain') {
                calculatedResults = await minimongoFind(collection, query.query);
            } else {
                calculatedResults = runAction(
                    action,
                    query.queryParams,
                    changeEvent,
                    query.results,
                    query.resultKeyDocumentMap
                );
            }

            if (!deepEqual(
                resultsFromExecute,
                calculatedResults
            )) {
                return {
                    correct: false,
                    handledEvents,
                    useQueries,
                    allDocs
                };
            }
        }
    }
    return {
        correct: true,
        handledEvents,
        useQueries,
        allDocs
    };
}