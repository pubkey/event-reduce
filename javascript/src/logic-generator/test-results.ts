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
    getReuseableChangeEvents
} from './data-generator';
import {
    calculateActionFromMap,
    runAction
} from '../';
import {
    getMinimongoCollection,
    minimongoFind,
    applyChangeEvent,
    getQueryParamsByMongoQuery
} from './minimongo-helper';
import { MinimongoCollection } from 'minimongo';
import { getStateSet } from '../states';

export type UseQuery = {
    query: MongoQuery,
    queryParams: QueryParams<Human>,
    results: Human[],
    resultKeyDocumentMap: ResultKeyDocumentMap<Human>
};

export interface TestResultsReturn {
    correct: boolean;
    useQueries: UseQuery[];
    collection: MinimongoCollection<Human>;
}

/**
 * runs many changes over the database
 * and checks after each change if the calculated results
 * are equal to the result of the query.
 */
export async function testResults(
    queries: MongoQuery[],
    stateSetToActionMap: StateSetToActionMap,
    useChangeEvents: ChangeEvent<Human>[],
    showLogs: boolean = false
): Promise<TestResultsReturn> {

    if (showLogs) {
        console.log(
            'testResults() with ' + queries.length + ' queries and ' +
            useChangeEvents.length + ' events'
        );
    }

    const collection = getMinimongoCollection();
    const useQueries: UseQuery[] = queries.map(query => {
        const queryParams: QueryParams<Human> = getQueryParamsByMongoQuery(query);
        return {
            query,
            queryParams,
            results: [],
            resultKeyDocumentMap: new Map()
        };
    });

    useChangeEvents = useChangeEvents.slice();
    while (useChangeEvents.length > 0) {
        // make change to database
        const changeEvent = useChangeEvents.shift();
        if (!changeEvent) {
            throw new Error('no more change events');
        }
        await applyChangeEvent(
            collection,
            changeEvent
        );

        // check if results matches for each query
        for (let i = 0; i < useQueries.length; i++) {
            const query: UseQuery = useQueries[i];
            const resultsFromExecute = await minimongoFind(collection, query.query);


            /*
            if (showLogs && query.query.limit === 5 && query.query.sort) {
                console.log('#'.repeat(200));
                console.dir(query.query);
                console.dir(changeEvent);
                console.dir(query.results);
                console.log('fromExec:');
                console.dir(resultsFromExecute);
            }*/

            const action = calculateActionFromMap(
                stateSetToActionMap,
                query.queryParams,
                changeEvent,
                query.results,
                query.resultKeyDocumentMap
            );



            let calculatedResults: Human[];
            if (action === 'runFullQueryAgain') {
                calculatedResults = resultsFromExecute.slice();
                query.resultKeyDocumentMap.clear();
                calculatedResults.forEach(doc => query.resultKeyDocumentMap.set(
                    doc._id,
                    doc
                ));
            } else {
                calculatedResults = runAction(
                    action,
                    query.queryParams,
                    changeEvent,
                    query.results,
                    query.resultKeyDocumentMap
                );
            }



            query.results = calculatedResults;
            if (showLogs && query.query.limit === 5 && query.query.sort) {
                console.log('after:');
                console.dir(query.results);
            }

            if (!deepEqual(
                resultsFromExecute,
                calculatedResults
            )) {
                return {
                    correct: false,
                    useQueries,
                    collection
                };
            }
        }
    }

    return {
        correct: true,
        useQueries,
        collection
    };
}
