import {
    RootNode,
    resolveWithSimpleBdd,
    ResolverFunctions
} from 'binary-decision-diagram';
import {
    performanceNow, wait
} from 'async-test-util';

import type {
    MongoQuery,
    StateResolveFunctionInput,
    ResultKeyDocumentMap,
    QueryParams,
    StateName,
    ActionFunctionInput
} from '../types/index.js';
import {
    orderedStateList,
    stateResolveFunctions
} from '../states/index.js';
import { HUMAN_MAX_AGE, randomHuman } from './data-generator.js';
import type { Human, Procedure } from './types.js';
import { flatClone, shuffleArray } from '../util.js';
import { mingoCollectionCreator } from './database/mingo.js';
import { applyChangeEvent } from './database/index.js';

export type PerformanceMeasurement = {
    [k in StateName]: number // avg runtime in ms
};


// an 'average' query
// used to measure performance
const testQuery: MongoQuery = {
    selector: {
        gender: 'f',
        age: {
            $gt: 11,
            $lt: 17
        }
    },
    skip: 1,
    limit: 30,
    sort: [
        'name',
        'age',
        '_id'
    ]
};

/**
 * measure how much cpu each of the state functions needs
 */
export async function measurePerformanceOfStateFunctions(
    rounds: number = 1000
): Promise<PerformanceMeasurement> {
    const ret: PerformanceMeasurement = {} as any;
    orderedStateList.forEach(k => ret[k] = 0);

    const collection = mingoCollectionCreator();
    await Promise.all(
        new Array(200).fill(0).map(() => collection.upsert(randomHuman()))
    );

    const previousResults = await collection.query(testQuery);

    const keyDocumentMap: ResultKeyDocumentMap<Human> = new Map();
    previousResults.forEach(d => keyDocumentMap.set(d._id, d));

    const addDoc = randomHuman();
    const queryParams = collection.getQueryParams(testQuery);

    const insertStateInput: StateResolveFunctionInput<Human> = {
        queryParams,
        changeEvent: {
            operation: 'INSERT',
            doc: addDoc,
            id: addDoc._id,
            previous: null
        },
        previousResults,
        keyDocumentMap
    };

    if (!previousResults[2]) {
        throw new Error('previousResults[2] not set');
    }
    const changedDoc = flatClone(previousResults[2]);
    changedDoc.age = HUMAN_MAX_AGE;
    changedDoc.name = 'alice';
    const updateStateInput: StateResolveFunctionInput<Human> = {
        queryParams,
        changeEvent: {
            operation: 'UPDATE',
            doc: changedDoc,
            id: changedDoc._id,
            previous: flatClone(previousResults[2])
        },
        previousResults,
        keyDocumentMap

    };

    const deleteStateInput: StateResolveFunctionInput<Human> = {
        queryParams,
        changeEvent: {
            operation: 'DELETE',
            doc: null,
            id: previousResults[2]._id,
            previous: flatClone(previousResults[2])
        },
        previousResults,
        keyDocumentMap

    };
    console.log('--- 2');

    let remainingRounds = rounds;
    while (remainingRounds > 0) {
        remainingRounds--;

        // do not use the same order each time
        const shuffledStateList = shuffleArray(orderedStateList);

        for (const stateName of shuffledStateList) {
            const stateFn = stateResolveFunctions[stateName];
            const startTime = performanceNow();
            stateFn(insertStateInput);
            stateFn(updateStateInput);
            stateFn(deleteStateInput);
            const endTime = performanceNow();
            const diff = endTime - startTime;
            ret[stateName] = ret[stateName] + diff;
        }

        if (remainingRounds % 10 === 0) {
            // console.log('.. ' + remainingRounds);
            await wait(50);
        }
    }

    // calculate average
    orderedStateList.forEach(k => ret[k] = (ret[k] / rounds));
    return ret;
}


/**
 * Comparator used to find the best sort-order of the boolean functions.
 * In the past we just used the bdd with the least amount of nodes.
 * But not all state-functions need the same performance so we optimize
 * to use the least amount of cpu cycles
 *
 * @returns the better bdd
 */
export async function getBetterBdd(
    a: RootNode,
    b: RootNode,
    perfMeasurement: PerformanceMeasurement,
    queries: MongoQuery[],
    procedures: Procedure[]
): Promise<RootNode> {
    const qA = await getQualityOfBdd(a, perfMeasurement, queries, procedures);
    const qB = await getQualityOfBdd(b, perfMeasurement, queries, procedures);
    if (qA > qB) {
        return a;
    } else {
        return b;
    }
}



export type FunctionUsageCount = {
    [k in StateName]: number;
};


const pseudoCollection = mingoCollectionCreator();

export function countFunctionUsages(
    bdd: RootNode,
    queries: MongoQuery[],
    procedures: Procedure[]
): FunctionUsageCount {
    const ret: FunctionUsageCount = {} as any;
    orderedStateList.forEach(stateName => ret[stateName] = 0);

    const countingResolvers: ResolverFunctions = {};
    orderedStateList.forEach((stateName, index) => {
        const fn = stateResolveFunctions[stateName];
        countingResolvers[index] = (i: StateResolveFunctionInput<Human>) => {
            ret[stateName] = ret[stateName] + 1;
            return fn(i);
        };
    });

    const queryParamsByQuery: Map<MongoQuery, QueryParams<Human>> = new Map();
    queries.forEach(query => {
        queryParamsByQuery.set(
            query,
            pseudoCollection.getQueryParams(query)
        );
    });

    for (const procedure of procedures) {
        const collection = mingoCollectionCreator();
        for (const changeEvent of procedure) {

            // get previous results
            const resultsBefore: Map<MongoQuery, Human[]> = new Map();

            queries.forEach(query => {
                const res = collection.query(query);
                resultsBefore.set(query, res);
            });

            applyChangeEvent(
                collection,
                changeEvent
            );

            for (const query of queries) {
                const params = queryParamsByQuery.get(query) as QueryParams<Human>;
                const previousResults = resultsBefore.get(query) as Human[];
                const input: ActionFunctionInput<Human> = {
                    changeEvent,
                    previousResults,
                    queryParams: params
                };

                const resolvedInput = resolveWithSimpleBdd(
                    bdd.toSimpleBdd(),
                    countingResolvers,
                    input
                );
            }
        }
    }

    return ret;
}

/**
 * returns the quality of the BDD,
 * the higher the better
 */
export const QUALITY_BY_BDD_CACHE: WeakMap<RootNode, number> = new WeakMap();
export function getQualityOfBdd(
    bdd: RootNode,
    perfMeasurement: PerformanceMeasurement,
    queries: MongoQuery[],
    procedures: Procedure[]
): number {
    if (!QUALITY_BY_BDD_CACHE.has(bdd)) {
        const usageCount = countFunctionUsages(bdd, queries, procedures);
        let totalTime = 0;
        Object.entries(usageCount).forEach(entry => {
            const stateName: StateName = entry[0] as StateName;
            const count = entry[1];
            const price = perfMeasurement[stateName];
            const value = count * price;
            totalTime = totalTime + value;
        });

        const quality = 1000 - totalTime;
        QUALITY_BY_BDD_CACHE.set(bdd, quality);
    }
    return QUALITY_BY_BDD_CACHE.get(bdd) as number;
}
