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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortObject = void 0;
const fs = __importStar(require("fs"));
const binary_decision_diagram_1 = require("binary-decision-diagram");
const config_js_1 = require("./config.js");
const queries_js_1 = require("./queries.js");
const procedures_js_1 = require("./procedures.js");
const index_js_1 = require("./index.js");
const util_js_1 = require("../util.js");
const util_js_2 = require("./util.js");
const fuzzing_js_1 = require("./fuzzing.js");
const write_bdd_template_js_1 = require("../bdd/write-bdd-template.js");
const calculate_bdd_quality_js_1 = require("./calculate-bdd-quality.js");
const index_js_2 = require("../states/index.js");
/**
 * sort object attributes
 * @link https://stackoverflow.com/a/39442287
 */
function sortObject(obj) {
    return Object
        .entries(obj)
        .sort()
        .reduce((_sortedObj, [k, v]) => ({
        ..._sortedObj,
        [k]: v
    }), {});
}
exports.sortObject = sortObject;
function loadTruthTable() {
    const truthTable = (0, util_js_1.objectToMap)((0, util_js_2.readJsonFile)(config_js_1.OUTPUT_TRUTH_TABLE_PATH));
    return truthTable;
}
function getQuality(bdd, perfMeasurement) {
    return (0, calculate_bdd_quality_js_1.getQualityOfBdd)(bdd, perfMeasurement, (0, queries_js_1.getQueryVariations)(), (0, procedures_js_1.getTestProcedures)());
}
const unknownValueActionId = 42;
async function run() {
    if (!fs.existsSync(config_js_1.OUTPUT_FOLDER_PATH)) {
        fs.mkdirSync(config_js_1.OUTPUT_FOLDER_PATH);
    }
    const args = process.argv;
    const command = args[2];
    console.log('run command: ' + command);
    console.log(__filename);
    switch (command) {
        case 'generate-truth-table':
            (async function generate() {
                const queries = (0, queries_js_1.getQueryVariations)();
                const procedures = (0, procedures_js_1.getTestProcedures)();
                const table = await (0, index_js_1.generateTruthTable)({
                    queries,
                    procedures,
                    log: true
                });
                console.dir(table);
                const tableObject = (0, util_js_1.mapToObject)(table);
                (0, util_js_2.writeJsonFile)(config_js_1.OUTPUT_TRUTH_TABLE_PATH, tableObject);
            })();
            break;
        case 'fuzzing':
            (async function fuzz() {
                const truthTable = (0, util_js_1.objectToMap)((0, util_js_2.readJsonFile)(config_js_1.OUTPUT_TRUTH_TABLE_PATH));
                const result = (0, fuzzing_js_1.fuzzing)(truthTable, 20, // queries
                20 // events
                );
                console.dir(result);
            })();
            break;
        /**
         * runs the fuzzing and each time a non-working set is found,
         * generate the table again
         */
        case 'iterative-fuzzing':
            (async function iterativeFuzzing() {
                let lastErrorFoundTime = new Date().getTime();
                const queries = (0, queries_js_1.getQueryVariations)();
                const procedures = (0, procedures_js_1.getTestProcedures)();
                let totalAmountOfHandled = 0;
                let totalAmountOfOptimized = 0;
                let truthTable = loadTruthTable();
                const startTruthTableEntries = truthTable.size;
                while (true) {
                    let fuzzingFoundError = false;
                    let fuzzingCount = 0;
                    while (!fuzzingFoundError) {
                        fuzzingCount++;
                        if (fuzzingCount % 10 === 0) {
                            console.log('#'.repeat(20));
                            console.log('run fuzzing() #' + fuzzingCount);
                            console.dir({
                                startTruthTableEntries,
                                currentTruthTableEntries: truthTable.size
                            });
                        }
                        /**
                         * Here we read in the truth table at each iteration.
                         * This makes it easy to run the fuzzing in parallel in multiple
                         * processes and an update to the truth table is propagated to the other processes.
                         * Implementing parallel fuzzing otherwise would be another point of failure.
                         * In the beginning of the fuzzing it might be overwrite each other multiple times
                         * but at later points it will less likely find new state-sets and in total
                         * we can test more random event-query spaces at the same time.
                         * Also the operating system will anyway in-memory cache the truth-table.json file
                         * and serve it very fast.
                         */
                        truthTable = loadTruthTable();
                        //                    const indexOfRunAgain = orderedActionList.indexOf('runFullQueryAgain');
                        //                      const map: StateActionIdMap = new Map();
                        //                        map.get = () => indexOfRunAgain;
                        const result = (0, fuzzing_js_1.fuzzing)(truthTable, 40, // queries
                        20 // events
                        );
                        totalAmountOfHandled = totalAmountOfHandled + result.amountOfHandled;
                        totalAmountOfOptimized = totalAmountOfOptimized + result.amountOfOptimized;
                        const percentage = (totalAmountOfOptimized / totalAmountOfHandled) * 100;
                        const rounded = percentage.toFixed(2);
                        if (fuzzingCount % 10 === 0) {
                            console.log('optimized ' + totalAmountOfOptimized + ' of ' + totalAmountOfHandled +
                                ' which is ' + rounded + '%');
                            const lastErrorAgo = new Date().getTime() - lastErrorFoundTime;
                            const lastErrorHours = lastErrorAgo / 1000 / 60 / 60;
                            console.log('Last error found ' + (0, util_js_1.roundToTwoDecimals)(lastErrorHours) + 'hours ago');
                        }
                        if (result.ok === false) {
                            console.log('fuzzingFoundError');
                            lastErrorFoundTime = new Date().getTime();
                            fuzzingFoundError = true;
                            console.log(JSON.stringify(result.query));
                            console.log(result.procedure.length + ' ' +
                                JSON.stringify(result.procedure, null, 4));
                            // add as first of array to ensure it will be used first in the future
                            // because new procedures are more likely to hit wrong states.
                            queries.unshift(result.query);
                            procedures.unshift(result.procedure);
                        }
                    }
                    // update table with fuzzing result
                    (0, index_js_1.generateTruthTable)({
                        table: truthTable,
                        queries,
                        procedures,
                        log: true
                    });
                    console.log('saving table to json');
                    const tableObject = (0, util_js_1.mapToObject)(truthTable);
                    (0, util_js_2.writeJsonFile)(config_js_1.OUTPUT_TRUTH_TABLE_PATH, sortObject(tableObject));
                }
            })();
            break;
        /**
         * Creates a fresh, un-optimized bdd from the truth table.
         * Use this to ensure the bdd still matches a newly generated table.
         */
        case 'create-bdd':
            (async function createBdd() {
                console.log('read table..');
                const truthTable = loadTruthTable();
                console.log('table size: ' + truthTable.size);
                // fill missing rows with unknown
                (0, binary_decision_diagram_1.fillTruthTable)(truthTable, truthTable.keys().next().value.length, unknownValueActionId);
                console.log('create bdd..');
                const bdd = (0, binary_decision_diagram_1.createBddFromTruthTable)(truthTable);
                console.log('mimizing..');
                console.log('remove unkown states..');
                bdd.removeIrrelevantLeafNodes(unknownValueActionId);
                bdd.log();
                const performanceMeasurement = await (0, calculate_bdd_quality_js_1.measurePerformanceOfStateFunctions)(2000);
                const quality = getQuality(bdd, performanceMeasurement);
                const bddMinimalString = (0, binary_decision_diagram_1.bddToMinimalString)(bdd);
                (0, write_bdd_template_js_1.writeBddTemplate)(bddMinimalString, performanceMeasurement, quality);
                console.log('nodes after minify: ' + bdd.countNodes());
            })();
            break;
        // optimizes the bdd to become small and fast
        case 'optimize-bdd':
            (async function optimizeBdd() {
                console.log('read table..');
                let lastBetterFoundTime = new Date().getTime();
                const truthTable = loadTruthTable();
                console.log('table size: ' + truthTable.size);
                // fill missing rows with unknown
                (0, binary_decision_diagram_1.fillTruthTable)(truthTable, truthTable.keys().next().value.length, unknownValueActionId);
                const optimizeState = JSON.parse(fs.readFileSync(write_bdd_template_js_1.BDD_OPTIMIZE_STATE_LOCATION, 'utf-8'));
                const performanceMeasurement = optimizeState.performanceMeasurement;
                let currentBest;
                const resolvers = {};
                new Array(index_js_2.orderedStateList.length).fill(0).forEach((_x, index) => {
                    const fn = (state) => (0, binary_decision_diagram_1.booleanStringToBoolean)(state[index]);
                    resolvers[index] = fn;
                });
                await (0, binary_decision_diagram_1.optimizeBruteForce)({
                    truthTable,
                    iterations: 10000000,
                    afterBddCreation: (bdd) => {
                        const lastBetterAgo = new Date().getTime() - lastBetterFoundTime;
                        const lastBetterHours = lastBetterAgo / 1000 / 60 / 60;
                        console.log('Last better bdd found ' + (0, util_js_1.roundToTwoDecimals)(lastBetterHours) + 'hours ago');
                        bdd.removeIrrelevantLeafNodes(unknownValueActionId);
                        if (currentBest) {
                            console.log('current best bdd has ' + currentBest.countNodes() + ' nodes ' +
                                'and a quality of ' + getQuality(currentBest, performanceMeasurement) + ' ' +
                                'while newly tested one has quality of ' + getQuality(bdd, performanceMeasurement));
                        }
                        else {
                            currentBest = bdd;
                        }
                    },
                    compareResults: (a, b) => {
                        const betterOne = (0, calculate_bdd_quality_js_1.getBetterBdd)(a, b, performanceMeasurement, (0, queries_js_1.getQueryVariations)(), (0, procedures_js_1.getTestProcedures)());
                        return betterOne;
                    },
                    onBetterBdd: async (res) => {
                        console.log('#'.repeat(100));
                        console.log('## Yeah! found better bdd ##');
                        lastBetterFoundTime = new Date().getTime();
                        const quality = getQuality(res.bdd, performanceMeasurement);
                        console.log('nodes: ' + res.bdd.countNodes());
                        console.log('quality(new): ' + quality);
                        console.log('quality(old): ' + getQuality(currentBest, performanceMeasurement));
                        const currentOptimizeState = JSON.parse(fs.readFileSync(write_bdd_template_js_1.BDD_OPTIMIZE_STATE_LOCATION, 'utf-8'));
                        console.log('currentOptimizeState.quality' + currentOptimizeState.quality);
                        currentBest = res.bdd;
                        // ensure correctness to have a double-check that the bdd works correctly
                        const bddMinimalString = (0, binary_decision_diagram_1.bddToMinimalString)(currentBest);
                        const simpleBdd = (0, binary_decision_diagram_1.minimalStringToSimpleBdd)(bddMinimalString);
                        for (const [key, value] of loadTruthTable().entries()) {
                            const bddValue = (0, binary_decision_diagram_1.resolveWithSimpleBdd)(simpleBdd, resolvers, key);
                            if (value !== bddValue) {
                                console.error('# Error: minimalBdd has different value compared to truth table ' + key);
                                console.dir({ value, bddValue });
                                process.exit(-1);
                            }
                        }
                        if (quality > currentOptimizeState.quality) {
                            console.log('########## BETTER THEN BEFORE ! -> Save it');
                            console.log('new string: ' + bddMinimalString);
                            (0, write_bdd_template_js_1.writeBddTemplate)(bddMinimalString, performanceMeasurement, quality);
                            console.log('-'.repeat(100));
                        }
                        else {
                            console.log('# DROP BECAUSE has better one with quality ' + currentOptimizeState.quality);
                        }
                    },
                    log: false
                });
            })();
            break;
        default:
            throw new Error('no use for command ' + command);
    }
}
run();
//# sourceMappingURL=runner.node.js.map