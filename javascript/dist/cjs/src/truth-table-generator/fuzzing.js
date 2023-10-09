"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fuzzing = void 0;
const queries_js_1 = require("./queries.js");
const data_generator_js_1 = require("./data-generator.js");
const minimongo_helper_js_1 = require("./minimongo-helper.js");
const index_js_1 = require("../states/index.js");
const index_js_2 = require("../actions/index.js");
const index_js_3 = require("./index.js");
/**
 * randomly generates queries and events
 * and returns on the first broken one
 *
 * returns ok:true if no problem was found
 */
async function fuzzing(table, queriesAmount = 30, eventsAmount = 100) {
    let amountOfHandled = 0;
    let amountOfOptimized = 0;
    const queries = new Array(queriesAmount)
        .fill(0)
        .map(() => (0, queries_js_1.randomQuery)());
    const procedure = await (0, data_generator_js_1.getRandomChangeEvents)(eventsAmount);
    const queryParamsByQuery = new Map();
    queries.forEach(query => {
        queryParamsByQuery.set(query, (0, minimongo_helper_js_1.getQueryParamsByMongoQuery)(query));
    });
    const collection = (0, minimongo_helper_js_1.getMinimongoCollection)();
    const usedChangeEvents = [];
    for (const changeEvent of procedure) {
        usedChangeEvents.push(changeEvent);
        // get previous results
        const resultsBefore = new Map();
        await Promise.all(queries.map(query => {
            return (0, minimongo_helper_js_1.minimongoFind)(collection, query)
                .then(res => resultsBefore.set(query, res));
        }));
        await (0, minimongo_helper_js_1.applyChangeEvent)(collection, changeEvent);
        // get results after event
        const resultsAfter = new Map();
        await Promise.all(queries.map(query => {
            return (0, minimongo_helper_js_1.minimongoFind)(collection, query)
                .then(res => resultsAfter.set(query, res));
        }));
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
            const state = (0, index_js_1.getStateSet)(input);
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
                const action = index_js_2.orderedActionList[currentActionId];
                amountOfHandled++;
                if (action !== 'runFullQueryAgain') {
                    amountOfOptimized++;
                }
                const ok = (0, index_js_3.doesActionWork)(input, after, action);
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
exports.fuzzing = fuzzing;
//# sourceMappingURL=fuzzing.js.map