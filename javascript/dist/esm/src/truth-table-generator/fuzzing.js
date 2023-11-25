import { randomQuery } from './queries.js';
import { getRandomChangeEvents } from './data-generator.js';
import { getStateSet } from '../states/index.js';
import { orderedActionList } from '../actions/index.js';
import { doesActionWork } from './index.js';
import { mingoCollectionCreator } from './database/mingo.js';
import { applyChangeEvent } from './database/index.js';
/**
 * randomly generates queries and events
 * and returns on the first broken one
 *
 * returns ok:true if no problem was found
 */
export function fuzzing(table, queriesAmount = 30, eventsAmount = 100) {
    let amountOfHandled = 0;
    let amountOfOptimized = 0;
    const queries = new Array(queriesAmount)
        .fill(0)
        .map(() => randomQuery());
    const procedure = getRandomChangeEvents(eventsAmount);
    const queryParamsByQuery = new Map();
    const collection = mingoCollectionCreator();
    queries.forEach(query => {
        queryParamsByQuery.set(query, collection.getQueryParams(query));
    });
    const usedChangeEvents = [];
    for (const changeEvent of procedure) {
        usedChangeEvents.push(changeEvent);
        // get previous results
        const resultsBefore = new Map();
        queries.forEach(query => {
            const res = collection.query(query);
            resultsBefore.set(query, res);
        });
        applyChangeEvent(collection, changeEvent);
        // get results after event
        const resultsAfter = new Map();
        queries.forEach(query => {
            const res = collection.query(query);
            resultsAfter.set(query, res);
        });
        // find action to generate after results
        for (const query of queries) {
            const params = queryParamsByQuery.get(query);
            const previousResults = resultsBefore.get(query);
            const after = resultsAfter.get(query);
            const input = {
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
            }
            else {
                const currentActionId = actionId;
                const action = orderedActionList[currentActionId];
                amountOfHandled++;
                if (action !== 'runFullQueryAgain') {
                    amountOfOptimized++;
                }
                const ok = doesActionWork(input, after, action);
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
//# sourceMappingURL=fuzzing.js.map