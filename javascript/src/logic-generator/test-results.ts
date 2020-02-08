import deepEqual from 'deep-equal';

import {
    QueryParams,
    ResultKeyDocumentMap,
    ChangeEvent,
    StateSetToActionMap,
    StateSet
} from '../types';
import {
    Human,
    MongoQuery
} from './types';
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
import { mapToObject } from '../util';
import { STATIC_RANDOM_HUMAN } from './data-generator';

export type UseQuery = {
    query: MongoQuery,
    queryParams: QueryParams<Human>,
    results: Human[],
    resultKeyDocumentMap: ResultKeyDocumentMap<Human>
};

export interface TestResultsReturn {
    correct: boolean;
    // list of all traversed states
    stateSets: Set<StateSet>;
    collection: MinimongoCollection<Human>;
    events: ChangeEvent<Human>[];
    errorQuery?: MongoQuery;
    calculatedResults?: Human[];
}

// to play array
export function shouldQueryBeLogged(query: MongoQuery): boolean {
    return true;
    if (query.limit === 3 && query.sort) {
        return true;
    } else {
        return false;
    }
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
    showLogs: boolean = false,
    surpressUnknownAction: boolean = false,
    checkKeyDocumentMap: boolean = false
): Promise<TestResultsReturn> {

    const travsersedStates: Set<StateSet> = new Set();

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
    const usedEvents: ChangeEvent<Human>[] = [];
    while (useChangeEvents.length > 0) {
        // make change to database
        const changeEvent = useChangeEvents.shift() as ChangeEvent<Human>;
        usedEvents.push(changeEvent);
        await applyChangeEvent(
            collection,
            changeEvent
        );

        // check if results matches for each query
        for (let i = 0; i < useQueries.length; i++) {
            const query: UseQuery = useQueries[i];
            const resultsFromExecute = await minimongoFind(collection, query.query);


            if (showLogs && shouldQueryBeLogged(query.query)) {
                console.log('#'.repeat(200));
                console.dir(query.query);
                console.dir(changeEvent);
                console.dir(query.results);
                console.log('resultsFromExecute:');
                console.dir(resultsFromExecute);
            }

            const actionResult = calculateActionFromMap(
                stateSetToActionMap,
                query.queryParams,
                changeEvent,
                query.results,
                query.resultKeyDocumentMap
            );
            travsersedStates.add(actionResult.stateSet);

            let calculatedResults: Human[];
            if (actionResult.action === 'runFullQueryAgain') {
                calculatedResults = resultsFromExecute.slice();
                query.resultKeyDocumentMap.clear();
                calculatedResults.forEach(doc => query.resultKeyDocumentMap.set(
                    doc._id,
                    doc
                ));
            } else {
                if (surpressUnknownAction && actionResult.action === 'unknownAction') {
                    calculatedResults = [
                        STATIC_RANDOM_HUMAN
                    ];
                    query.resultKeyDocumentMap.clear();
                    query.resultKeyDocumentMap.set(
                        STATIC_RANDOM_HUMAN._id,
                        STATIC_RANDOM_HUMAN
                    );
                } else {
                    calculatedResults = runAction(
                        actionResult.action,
                        query.queryParams,
                        changeEvent,
                        query.results,
                        query.resultKeyDocumentMap
                    );
                }

            }

            query.results = calculatedResults;


            if (showLogs && shouldQueryBeLogged(query.query)) {
                console.log('action: ' + actionResult.action);
                console.log('after:');
                console.dir(query.results);
            }

            if (
                // optimisation shortcut, this is faster because we know we have two arrays
                resultsFromExecute.length !== calculatedResults.length ||
                !deepEqual(
                    resultsFromExecute,
                    calculatedResults
                )
            ) {


                if (showLogs && shouldQueryBeLogged(query.query)) {
                    console.log('::::::::::::::::::: results not equal');
                }


                return {
                    correct: false,
                    collection,
                    stateSets: travsersedStates,
                    errorQuery: query.query,
                    calculatedResults,
                    events: usedEvents
                };
            }

            /**
             * set this to true if you think there might be some bug
             * on calculating the document map in the action-functions
             */
            if (checkKeyDocumentMap) {
                if (query.results.length !== query.resultKeyDocumentMap.size) {
                    console.log('----------- results:');
                    console.dir(query.results);
                    console.log('map:');
                    console.dir(mapToObject(query.resultKeyDocumentMap));
                    throw new Error('key document map has wrong size ' + actionResult.action);
                }
                query.results.forEach(doc => {
                    const mapValue = query.resultKeyDocumentMap.get(doc._id);
                    if (!deepEqual(
                        doc,
                        mapValue
                    )) {
                        console.dir(doc);
                        console.dir(mapValue);
                        throw new Error('key document map has wrong doc ' + actionResult.action);
                    }
                });
            }
        }
    }

    return {
        correct: true,
        collection,
        stateSets: travsersedStates,
        events: usedEvents
    };
}
