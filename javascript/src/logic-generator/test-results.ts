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
    collection: MinimongoCollection<Human>;
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
    const useChangeEvents: ChangeEvent<Human>[] = await getReuseableChangeEvents(writesAmount);

    const useQueries: UseQuery[] = queries.map(query => {
        const queryParams: QueryParams<Human> = getQueryParamsByMongoQuery(query);
        return {
            query,
            queryParams,
            results: [],
            resultKeyDocumentMap: new Map()
        };
    });

    const handledEvents: ChangeEvent<Human>[] = [];

    while (writesAmount > 0) {
        writesAmount--;

        // make change to database
        const changeEvent = useChangeEvents.shift();
        if (!changeEvent) {
            throw new Error('no more change events');
        }
        handledEvents.push(changeEvent);
        await applyChangeEvent(
            collection,
            changeEvent
        );

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
                calculatedResults = resultsFromExecute.slice();
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
                    collection
                };
            }
        }
    }

    return {
        correct: true,
        handledEvents,
        useQueries,
        collection
    };
}
