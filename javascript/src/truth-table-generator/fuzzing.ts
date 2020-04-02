import type {
    QueryParams,
    ActionFunctionInput,
    ChangeEvent,
    ActionName,
    MongoQuery
} from '../types';
import type {
    Procedure,
    StateActionIdMap,
    Human
} from './types';
import { randomQuery } from './queries';
import { getRandomChangeEvents } from './data-generator';
import {
    getMinimongoCollection,
    getQueryParamsByMongoQuery,
    minimongoFind,
    applyChangeEvent
} from './minimongo-helper';
import { getStateSet } from '../states';
import { doesActionWork } from '.';
import { orderedActionList } from '../actions';

export type FuzzingReturn = {
    ok: boolean,
    query: MongoQuery,
    procedure: Procedure,
    amountOfHandled: number,
    amountOfOptimized: number
};

/**
 * randomly generates queries and events
 * and returns on the first broken one
 *
 * returns ok:true if no problem was found
 */
export async function fuzzing(
    table: StateActionIdMap,
    queriesAmount: number = 30,
    eventsAmount: number = 100
): Promise<FuzzingReturn> {
    let amountOfHandled = 0;
    let amountOfOptimized = 0;

    const queries: MongoQuery[] = new Array(queriesAmount)
        .fill(0)
        .map(() => randomQuery());

    const procedure = await getRandomChangeEvents(eventsAmount);
    const queryParamsByQuery: Map<MongoQuery, QueryParams<Human>> = new Map();
    queries.forEach(query => {
        queryParamsByQuery.set(
            query,
            getQueryParamsByMongoQuery(query)
        );
    });
    const collection = getMinimongoCollection();

    const usedChangeEvents: ChangeEvent<Human>[] = [];
    for (const changeEvent of procedure) {
        usedChangeEvents.push(changeEvent);

        // get previous results
        const resultsBefore: Map<MongoQuery, Human[]> = new Map();
        await Promise.all(
            queries.map(query => {
                return minimongoFind(collection, query)
                    .then(res => resultsBefore.set(query, res));
            })
        );

        await applyChangeEvent(
            collection,
            changeEvent
        );

        // get results after event
        const resultsAfter: Map<MongoQuery, Human[]> = new Map();
        await Promise.all(
            queries.map(query => {
                return minimongoFind(collection, query)
                    .then(res => resultsAfter.set(query, res));
            })
        );

        // find action to generate after results
        for (const query of queries) {
            const params = queryParamsByQuery.get(query) as QueryParams<Human>;
            const previousResults = resultsBefore.get(query) as Human[];
            const after = resultsAfter.get(query) as Human[];
            const input: ActionFunctionInput<Human> = {
                changeEvent,
                previousResults,
                queryParams: params
            };
            const state = getStateSet(input);
            const actionId = table.get(state);

            if (typeof actionId !== 'number') {
                return {
                    ok: false,
                    query,
                    procedure: usedChangeEvents,
                    amountOfHandled,
                    amountOfOptimized
                };
            } else {
                const currentActionId = actionId as number;
                const action: ActionName = orderedActionList[currentActionId];
                amountOfHandled++;
                if (action !== 'runFullQueryAgain') {
                    amountOfOptimized++;
                }
                const ok = doesActionWork(
                    input,
                    after,
                    action
                );
                if (!ok) {
                    return {
                        ok: false,
                        query,
                        procedure: usedChangeEvents,
                        amountOfHandled,
                        amountOfOptimized
                    };
                }
            }
        }
    }

    return {
        ok: true,
        query: queries[0],
        procedure,
        amountOfHandled,
        amountOfOptimized
    };
}
