import {
    QueryParams,
    ActionFunctionInput
} from '../types';
import { randomQuery } from './queries';
import {
    MongoQuery, Procedure,
    StateActionIdMap, Human
} from './types';
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



/**
 * randomly generates queries and events
 * and returns on the first broken one
 * 
 * returns false if no problem was found
 */
export async function fuzzing(
    table: StateActionIdMap,
    queriesAmount: number = 30,
    eventsAmount: number = 100
): Promise<{
    ok: boolean,
    query: MongoQuery,
    procedure: Procedure
}> {
    const queries: MongoQuery[] = new Array(queriesAmount)
        .fill(0)
        .map(() => randomQuery());
    // console.dir(queries);
    const procedure = await getRandomChangeEvents(eventsAmount);
    const queryParamsByQuery: Map<MongoQuery, QueryParams<Human>> = new Map();
    queries.forEach(async (query) => {
        queryParamsByQuery.set(
            query,
            getQueryParamsByMongoQuery(query)
        );
    });
    const collection = getMinimongoCollection();

    for (const changeEvent of procedure) {
        // get previous results
        const resultsBefore: Map<MongoQuery, Human[]> = new Map();
        await Promise.all(
            queries.map(async (query) => {
                const res = await minimongoFind(collection, query);
                resultsBefore.set(query, res);
            })
        );

        await applyChangeEvent(
            collection,
            changeEvent
        );

        // find action to generate after results
        for (const query of queries) {
            const params = queryParamsByQuery.get(query) as QueryParams<Human>;
            const before = resultsBefore.get(query) as Human[];
            const after = await minimongoFind(collection, query);
            const input: ActionFunctionInput<Human> = {
                changeEvent,
                previousResults: before.slice(),
                queryParams: params
            };
            const state = getStateSet(input);
            const actionId = table.get(state);

            if (typeof actionId !== 'number') {
                return {
                    ok: false,
                    query,
                    procedure
                };
            } else {
                const currentActionId = table.get(state) as number;
                const ok = doesActionWork(
                    input,
                    after,
                    orderedActionList[currentActionId]
                );
                if (!ok) {
                    return {
                        ok: false,
                        query,
                        procedure
                    };
                }
            }
        }
    }

    return {
        ok: true,
        query: queries[0],
        procedure
    };
}
