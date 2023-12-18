import * as fs from 'fs';
import {
    createBddFromTruthTable,
    TruthTable,
    bddToMinimalString,
    fillTruthTable,
    optimizeBruteForce,
    OptimisationResult,
    RootNode,
    resolveWithSimpleBdd,
    ResolverFunctions,
    booleanStringToBoolean,
    minimalStringToSimpleBdd
} from 'binary-decision-diagram';

import type { StateActionIdMap } from './types.js';
import {
    OUTPUT_FOLDER_PATH,
    OUTPUT_TRUTH_TABLE_PATH
} from './config.js';
import { getQueryVariations } from './queries.js';
import { getTestProcedures } from './procedures.js';
import { generateTruthTable } from './index.js';
import {
    mapToObject,
    objectToMap,
    roundToTwoDecimals
} from '../util.js';
import {
    readJsonFile,
    writeJsonFile
} from './util.js';
import { fuzzing } from './fuzzing.js';
import { BDD_OPTIMIZE_STATE_LOCATION, writeBddTemplate } from '../bdd/write-bdd-template.js';
import {
    measurePerformanceOfStateFunctions,
    getBetterBdd,
    getQualityOfBdd,
    PerformanceMeasurement
} from './calculate-bdd-quality.js';
import { orderedStateList } from '../states/index.js';

/**
 * sort object attributes
 * @link https://stackoverflow.com/a/39442287
 */
export function sortObject<T>(obj: T): T {
    return Object
        .entries(obj as any)
        .sort()
        .reduce((_sortedObj, [k, v]) => ({
            ..._sortedObj,
            [k]: v
        }), {}) as T;
}

function loadTruthTable() {
    const truthTable: TruthTable = objectToMap(
        readJsonFile(OUTPUT_TRUTH_TABLE_PATH)
    );
    return truthTable;
}
function getQuality(
    bdd: RootNode,
    perfMeasurement: PerformanceMeasurement
) {
    return getQualityOfBdd(
        bdd,
        perfMeasurement,
        getQueryVariations(),
        getTestProcedures()
    );
}


const unknownValueActionId: number = 42;

async function run() {

    if (!fs.existsSync(OUTPUT_FOLDER_PATH)) {
        fs.mkdirSync(OUTPUT_FOLDER_PATH);
    }

    const args = process.argv;
    const command = args[2];
    console.log('run command: ' + command);
    console.log(__filename);

    switch (command) {
        case 'generate-truth-table':
            (async function generate() {
                const queries = getQueryVariations();
                const procedures = getTestProcedures();
                const table = await generateTruthTable({
                    queries,
                    procedures,
                    log: true
                });

                console.dir(table);
                const tableObject = mapToObject(table);
                writeJsonFile(
                    OUTPUT_TRUTH_TABLE_PATH,
                    tableObject
                );
            })();
            break;

        case 'fuzzing':
            (async function fuzz() {
                const truthTable: StateActionIdMap = objectToMap(
                    readJsonFile(OUTPUT_TRUTH_TABLE_PATH)
                );
                const result = fuzzing(
                    truthTable,
                    20, // queries
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

                const queries = getQueryVariations();
                const procedures = getTestProcedures();
                let totalAmountOfHandled = 0;
                let totalAmountOfOptimized = 0;

                let truthTable: StateActionIdMap = loadTruthTable();
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

                        const result = fuzzing(
                            truthTable,
                            40, // queries
                            20 // events
                        );
                        totalAmountOfHandled = totalAmountOfHandled + result.amountOfHandled;
                        totalAmountOfOptimized = totalAmountOfOptimized + result.amountOfOptimized;

                        const percentage = (totalAmountOfOptimized / totalAmountOfHandled) * 100;
                        const rounded = percentage.toFixed(2);

                        if (fuzzingCount % 10 === 0) {
                            console.log(
                                'optimized ' + totalAmountOfOptimized + ' of ' + totalAmountOfHandled +
                                ' which is ' + rounded + '%'
                            );
                            const lastErrorAgo = new Date().getTime() - lastErrorFoundTime;
                            const lastErrorHours = lastErrorAgo / 1000 / 60 / 60;
                            console.log('Last error found ' + roundToTwoDecimals(lastErrorHours) + 'hours ago');
                        }

                        if (result.ok === false) {
                            console.log('fuzzingFoundError');
                            lastErrorFoundTime = new Date().getTime();
                            fuzzingFoundError = true;
                            console.log(JSON.stringify(result.query));
                            console.log(
                                result.procedure.length + ' ' +
                                JSON.stringify(result.procedure, null, 4)
                            );

                            // add as first of array to ensure it will be used first in the future
                            // because new procedures are more likely to hit wrong states.
                            queries.unshift(result.query);
                            procedures.unshift(result.procedure);
                        }
                    }

                    // update table with fuzzing result
                    generateTruthTable({
                        table: truthTable,
                        queries,
                        procedures,
                        log: true
                    });

                    console.log('saving table to json');
                    const tableObject = mapToObject(truthTable);
                    writeJsonFile(
                        OUTPUT_TRUTH_TABLE_PATH,
                        sortObject(tableObject)
                    );
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
                fillTruthTable(
                    truthTable,
                    truthTable.keys().next().value.length,
                    unknownValueActionId
                );

                console.log('create bdd..');

                const bdd = createBddFromTruthTable(truthTable);
                console.log('mimizing..');
                console.log('remove unkown states..');
                bdd.removeIrrelevantLeafNodes(unknownValueActionId);

                bdd.log();
                const performanceMeasurement = await measurePerformanceOfStateFunctions(2000);
                const quality = getQuality(bdd, performanceMeasurement);

                const bddMinimalString = bddToMinimalString(bdd);
                writeBddTemplate(
                    bddMinimalString,
                    performanceMeasurement,
                    quality
                );

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
                fillTruthTable(
                    truthTable,
                    truthTable.keys().next().value.length,
                    unknownValueActionId
                );


                const optimizeState = JSON.parse(fs.readFileSync(BDD_OPTIMIZE_STATE_LOCATION, 'utf-8'));
                const performanceMeasurement = optimizeState.performanceMeasurement;
                let currentBest: RootNode;
                const resolvers: ResolverFunctions = {};
                new Array(orderedStateList.length).fill(0).forEach((_x, index) => {
                    const fn = (state: string) => booleanStringToBoolean((state as any)[index]);
                    resolvers[index] = fn;
                });

                await optimizeBruteForce({
                    truthTable,
                    iterations: 10000000,
                    afterBddCreation: (bdd: RootNode) => {
                        const lastBetterAgo = new Date().getTime() - lastBetterFoundTime;
                        const lastBetterHours = lastBetterAgo / 1000 / 60 / 60;
                        console.log('Last better bdd found ' + roundToTwoDecimals(lastBetterHours) + 'hours ago');
                        bdd.removeIrrelevantLeafNodes(unknownValueActionId);

                        if (currentBest) {
                            console.log(
                                'current best bdd has ' + currentBest.countNodes() + ' nodes ' +
                                'and a quality of ' + getQuality(currentBest, performanceMeasurement) + ' ' +
                                'while newly tested one has quality of ' + getQuality(bdd, performanceMeasurement)
                            );
                        } else {
                            currentBest = bdd;
                        }
                    },
                    compareResults: (a: RootNode, b: RootNode) => {
                        const betterOne = getBetterBdd(
                            a, b,
                            performanceMeasurement,
                            getQueryVariations(),
                            getTestProcedures()
                        );
                        return betterOne;
                    },
                    onBetterBdd: async (res: OptimisationResult) => {
                        console.log('#'.repeat(100));
                        console.log('## Yeah! found better bdd ##');
                        lastBetterFoundTime = new Date().getTime();
                        const quality = getQuality(res.bdd, performanceMeasurement);
                        console.log('nodes: ' + res.bdd.countNodes());
                        console.log('quality(new): ' + quality);
                        console.log('quality(old): ' + getQuality(currentBest, performanceMeasurement));
                        const currentOptimizeState = JSON.parse(fs.readFileSync(BDD_OPTIMIZE_STATE_LOCATION, 'utf-8'));
                        console.log('currentOptimizeState.quality' + currentOptimizeState.quality);

                        currentBest = res.bdd;

                        // ensure correctness to have a double-check that the bdd works correctly
                        const bddMinimalString = bddToMinimalString(currentBest);
                        const simpleBdd = minimalStringToSimpleBdd(bddMinimalString);
                        for (const [key, value] of loadTruthTable().entries()) {
                            const bddValue = resolveWithSimpleBdd(
                                simpleBdd,
                                resolvers,
                                key
                            );

                            if (value !== bddValue) {
                                console.error('# Error: minimalBdd has different value compared to truth table ' + key);
                                console.dir({ value, bddValue });
                                process.exit(-1);
                            }
                        }




                        if (quality > currentOptimizeState.quality) {
                            console.log('########## BETTER THEN BEFORE ! -> Save it');
                            console.log('new string: ' + bddMinimalString);
                            writeBddTemplate(
                                bddMinimalString,
                                performanceMeasurement,
                                quality
                            );
                            console.log('-'.repeat(100));
                        } else {
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
