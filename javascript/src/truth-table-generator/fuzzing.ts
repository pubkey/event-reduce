import type {
    QueryParams,
    ActionFunctionInput,
    ChangeEvent,
    ActionName,
    MongoQuery
} from '../types/index.js';
import type {
    Procedure,
    StateActionIdMap,
    Human
} from './types.js';
import { randomQuery } from './queries.js';
import { getRandomChangeEvents } from './data-generator.js';
import { getStateSet } from '../states/index.js';
import { orderedActionList } from '../actions/index.js';
import { doesActionWork } from './index.js';
import { mingoCollectionCreator } from './database/mingo.js';
import { applyChangeEvent } from './database/index.js';

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
export function fuzzing(
    table: StateActionIdMap,
    queriesAmount: number = 30,
    eventsAmount: number = 100
): FuzzingReturn {
    let amountOfHandled = 0;
    let amountOfOptimized = 0;

    const queries: MongoQuery[] = new Array(queriesAmount)
        .fill(0)
        .map(() => randomQuery());

    const procedure = getRandomChangeEvents(eventsAmount);
    const queryParamsByQuery: Map<MongoQuery, QueryParams<Human>> = new Map();
    const collection = mingoCollectionCreator();
    queries.forEach(query => {
        queryParamsByQuery.set(
            query,
            collection.getQueryParams(query)
        );
    });

    const usedChangeEvents: ChangeEvent<Human>[] = [];
    for (const changeEvent of procedure) {
        usedChangeEvents.push(changeEvent);

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

        // get results after event
        const resultsAfter: Map<MongoQuery, Human[]> = new Map();
        queries.forEach(query => {
            const res = collection.query(query);
            resultsAfter.set(query, res);
        });

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
