"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.doesActionWork = exports.getNextWorkingAction = exports.incrementTruthTableActions = exports.generateTruthTable = void 0;
const deep_equal_1 = __importDefault(require("deep-equal"));
const index_js_1 = require("../index.js");
const index_js_2 = require("../actions/index.js");
const index_js_3 = require("../states/index.js");
const mingo_js_1 = require("./database/mingo.js");
const index_js_4 = require("./database/index.js");
function generateTruthTable({ queries, procedures, table = new Map(), log = false }) {
    let done = false;
    while (!done) {
        let totalChanges = 0;
        for (const procedure of procedures) {
            if (log) {
                console.log('generateTruthTable() next procedure with ' + procedure.length + ' events');
            }
            const changes = incrementTruthTableActions(table, queries, procedure, log);
            totalChanges = totalChanges + changes;
        }
        if (totalChanges === 0) {
            done = true;
        }
    }
    return table;
}
exports.generateTruthTable = generateTruthTable;
function incrementTruthTableActions(table = new Map(), queries, procedure, log = false) {
    if (log) {
        console.log('incrementTruthTableActions()');
    }
    let changesCount = 0;
    const queryParamsByQuery = new Map();
    const collection = (0, mingo_js_1.mingoCollectionCreator)();
    queries.forEach((query) => {
        queryParamsByQuery.set(query, collection.getQueryParams(query));
    });
    const resultsBefore = new Map();
    queries.forEach((query) => {
        resultsBefore.set(query, []);
    });
    for (const changeEvent of procedure) {
        (0, index_js_4.applyChangeEvent)(collection, changeEvent);
        // find action to generate after results
        for (const query of queries) {
            const params = queryParamsByQuery.get(query);
            const before = resultsBefore.get(query);
            const after = collection.query(query);
            const input = {
                changeEvent,
                previousResults: before.slice(),
                queryParams: params
            };
            const state = (0, index_js_3.getStateSet)(input);
            if (state === '10000000011000000') {
                console.log('!!');
                process.exit();
            }
            let currentActionId = table.get(state);
            if (!currentActionId) {
                table.set(state, 0);
                currentActionId = 0;
            }
            const nextWorking = getNextWorkingAction(input, after, currentActionId);
            resultsBefore.set(query, after);
            if (nextWorking !== currentActionId) {
                table.set(state, nextWorking);
                changesCount++;
                if (log) {
                    console.log('nextWorking() ' + state + ' - from ' +
                        index_js_2.orderedActionList[currentActionId] +
                        ' to ' + index_js_2.orderedActionList[nextWorking]);
                }
            }
        }
    }
    return changesCount;
}
exports.incrementTruthTableActions = incrementTruthTableActions;
function getNextWorkingAction(input, resultAfter, lastWorkingActionId, log = false) {
    let t = lastWorkingActionId;
    while (t <= index_js_2.orderedActionList.length) {
        const actionName = index_js_2.orderedActionList[t];
        const doesWork = doesActionWork(input, resultAfter, actionName, log);
        // console.log(actionName + ' :: ' + doesWork);
        if (doesWork) {
            if (actionName === 'alwaysWrong') {
                throw new Error('action alwaysWrong cannot be true');
            }
            return t;
        }
        t++;
    }
    throw new Error('this should never happen');
}
exports.getNextWorkingAction = getNextWorkingAction;
/**
 * returns true if the action calculates the same
 * results as given
 */
function doesActionWork(input, resultAfter, actionName, log = false) {
    if (actionName === 'runFullQueryAgain') {
        return true;
    }
    /*
    console.log('--- '.repeat(100));
    console.dir(input);
    console.dir(input.previousResults);
    console.dir(resultAfter);*/
    const calculatedResults = (0, index_js_1.runAction)(actionName, input.queryParams, input.changeEvent, input.previousResults.slice());
    // console.dir(calculatedResults);
    if (
    // optimisation shortcut, this is faster because we know we have two arrays
    calculatedResults.length === resultAfter.length &&
        (0, deep_equal_1.default)(calculatedResults, resultAfter)) {
        return true;
    }
    else {
        return false;
    }
}
exports.doesActionWork = doesActionWork;
//# sourceMappingURL=index.js.map