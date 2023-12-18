"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
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
__exportStar(require("./binary-state.js"), exports);
__exportStar(require("./calculate-bdd-quality.js"), exports);
__exportStar(require("./data-generator.js"), exports);
__exportStar(require("./fuzzing.js"), exports);
__exportStar(require("./procedures.js"), exports);
__exportStar(require("./queries.js"), exports);
__exportStar(require("./database/index.js"), exports);
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
    const calculatedResults = (0, index_js_1.runAction)(actionName, input.queryParams, input.changeEvent, input.previousResults.slice());
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