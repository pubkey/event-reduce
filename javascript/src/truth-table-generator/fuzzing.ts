import {
    QueryParams,
    ActionFunctionInput,
    ChangeEvent,
    ActionName,
    MongoQuery
} from '../types';
import { randomQuery } from './queries';
import {
    Procedure,
    StateActionIdMap,
    Human
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
    procedure: Procedure,
    amountOfHandled: number,
    amountOfOptimized: number
}> {
    let amountOfHandled = 0;
    let amountOfOptimized = 0;

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

    const usedChangeEvents: ChangeEvent<Human>[] = [];
    for (const changeEvent of procedure) {
        usedChangeEvents.push(changeEvent);

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
                    procedure: usedChangeEvents,
                    amountOfHandled,
                    amountOfOptimized
                };
            } else {
                const currentActionId = table.get(state) as number;
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
