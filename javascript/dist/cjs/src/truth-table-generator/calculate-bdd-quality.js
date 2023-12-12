"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQualityOfBdd = exports.QUALITY_BY_BDD_CACHE = exports.countFunctionUsages = exports.getBetterBdd = exports.measurePerformanceOfStateFunctions = void 0;
const binary_decision_diagram_1 = require("binary-decision-diagram");
const async_test_util_1 = require("async-test-util");
const index_js_1 = require("../states/index.js");
const data_generator_js_1 = require("./data-generator.js");
const util_js_1 = require("../util.js");
const mingo_js_1 = require("./database/mingo.js");
const index_js_2 = require("./database/index.js");
// an 'average' query
// used to measure performance
const testQuery = {
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
async function measurePerformanceOfStateFunctions(rounds = 1000) {
    const ret = {};
    index_js_1.orderedStateList.forEach(k => ret[k] = 0);
    const collection = (0, mingo_js_1.mingoCollectionCreator)();
    await Promise.all(new Array(200).fill(0).map(() => collection.upsert((0, data_generator_js_1.randomHuman)())));
    const previousResults = await collection.query(testQuery);
    const keyDocumentMap = new Map();
    previousResults.forEach(d => keyDocumentMap.set(d._id, d));
    const addDoc = (0, data_generator_js_1.randomHuman)();
    const queryParams = collection.getQueryParams(testQuery);
    const insertStateInput = {
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
    const changedDoc = (0, util_js_1.flatClone)(previousResults[2]);
    changedDoc.age = data_generator_js_1.HUMAN_MAX_AGE;
    changedDoc.name = 'alice';
    const updateStateInput = {
        queryParams,
        changeEvent: {
            operation: 'UPDATE',
            doc: changedDoc,
            id: changedDoc._id,
            previous: (0, util_js_1.flatClone)(previousResults[2])
        },
        previousResults,
        keyDocumentMap
    };
    const deleteStateInput = {
        queryParams,
        changeEvent: {
            operation: 'DELETE',
            doc: null,
            id: previousResults[2]._id,
            previous: (0, util_js_1.flatClone)(previousResults[2])
        },
        previousResults,
        keyDocumentMap
    };
    console.log('--- 2');
    let remainingRounds = rounds;
    while (remainingRounds > 0) {
        remainingRounds--;
        // do not use the same order each time
        const shuffledStateList = (0, util_js_1.shuffleArray)(index_js_1.orderedStateList);
        for (const stateName of shuffledStateList) {
            const stateFn = index_js_1.stateResolveFunctions[stateName];
            const startTime = (0, async_test_util_1.performanceNow)();
            stateFn(insertStateInput);
            stateFn(updateStateInput);
            stateFn(deleteStateInput);
            const endTime = (0, async_test_util_1.performanceNow)();
            const diff = endTime - startTime;
            ret[stateName] = ret[stateName] + diff;
        }
        if (remainingRounds % 10 === 0) {
            // console.log('.. ' + remainingRounds);
            await (0, async_test_util_1.wait)(50);
        }
    }
    // calculate average
    index_js_1.orderedStateList.forEach(k => ret[k] = (ret[k] / rounds));
    return ret;
}
exports.measurePerformanceOfStateFunctions = measurePerformanceOfStateFunctions;
/**
 * Comparator used to find the best sort-order of the boolean functions.
 * In the past we just used the bdd with the least amount of nodes.
 * But not all state-functions need the same performance so we optimize
 * to use the least amount of cpu cycles
 *
 * @returns the better bdd
 */
async function getBetterBdd(a, b, perfMeasurement, queries, procedures) {
    const qA = await getQualityOfBdd(a, perfMeasurement, queries, procedures);
    const qB = await getQualityOfBdd(b, perfMeasurement, queries, procedures);
    if (qA > qB) {
        return a;
    }
    else {
        return b;
    }
}
exports.getBetterBdd = getBetterBdd;
const pseudoCollection = (0, mingo_js_1.mingoCollectionCreator)();
function countFunctionUsages(bdd, queries, procedures) {
    const ret = {};
    index_js_1.orderedStateList.forEach(stateName => ret[stateName] = 0);
    const countingResolvers = {};
    index_js_1.orderedStateList.forEach((stateName, index) => {
        const fn = index_js_1.stateResolveFunctions[stateName];
        countingResolvers[index] = (i) => {
            ret[stateName] = ret[stateName] + 1;
            return fn(i);
        };
    });
    const queryParamsByQuery = new Map();
    queries.forEach(query => {
        queryParamsByQuery.set(query, pseudoCollection.getQueryParams(query));
    });
    for (const procedure of procedures) {
        const collection = (0, mingo_js_1.mingoCollectionCreator)();
        for (const changeEvent of procedure) {
            // get previous results
            const resultsBefore = new Map();
            queries.forEach(query => {
                const res = collection.query(query);
                resultsBefore.set(query, res);
            });
            (0, index_js_2.applyChangeEvent)(collection, changeEvent);
            for (const query of queries) {
                const params = queryParamsByQuery.get(query);
                const previousResults = resultsBefore.get(query);
                const input = {
                    changeEvent,
                    previousResults,
                    queryParams: params
                };
                const resolvedInput = (0, binary_decision_diagram_1.resolveWithSimpleBdd)(bdd.toSimpleBdd(), countingResolvers, input);
            }
        }
    }
    return ret;
}
exports.countFunctionUsages = countFunctionUsages;
/**
 * returns the quality of the BDD,
 * the higher the better
 */
exports.QUALITY_BY_BDD_CACHE = new WeakMap();
function getQualityOfBdd(bdd, perfMeasurement, queries, procedures) {
    if (!exports.QUALITY_BY_BDD_CACHE.has(bdd)) {
        const usageCount = countFunctionUsages(bdd, queries, procedures);
        let totalTime = 0;
        Object.entries(usageCount).forEach(entry => {
            const stateName = entry[0];
            const count = entry[1];
            const price = perfMeasurement[stateName];
            const value = count * price;
            totalTime = totalTime + value;
        });
        const quality = 1000 - totalTime;
        exports.QUALITY_BY_BDD_CACHE.set(bdd, quality);
    }
    return exports.QUALITY_BY_BDD_CACHE.get(bdd);
}
exports.getQualityOfBdd = getQualityOfBdd;
//# sourceMappingURL=calculate-bdd-quality.js.map