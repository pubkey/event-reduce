import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import {
    createBddFromTruthTable,
    TruthTable,
    fillTruthTable,
    optimizeOrdering,
    RootNode,
    ResolverFunctions,
    booleanStringToBoolean,
    bddToPackedBdd,
    packedBddToBase64String,
    packedBddFromBase64String,
    resolveWithPackedBdd,
    PackedBdd
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
    countStateSetOccurrences,
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

/**
 * Resolvers that read the boolean values directly from a state set string.
 */
function getStateSetResolvers(): ResolverFunctions<string> {
    const resolvers: ResolverFunctions<string> = {};
    orderedStateList.forEach((_stateName, index) => {
        resolvers[index] = (stateSet: string) => booleanStringToBoolean(stateSet[index] as any);
    });
    return resolvers;
}

/**
 * Double-check that the packed bdd
 * returns the same values as the truth table.
 */
function ensurePackedBddMatchesTruthTable(
    packedBdd: PackedBdd,
    truthTable: TruthTable
) {
    const resolvers = getStateSetResolvers();
    for (const [key, value] of truthTable.entries()) {
        const bddValue = resolveWithPackedBdd(
            packedBdd,
            resolvers,
            key
        );
        if (value !== bddValue) {
            console.error('# Error: packed bdd has different value compared to truth table ' + key);
            console.dir({ value, bddValue });
            process.exit(-1);
        }
    }
}

/**
 * Returns the ordering (ordering[level] = index of the state function)
 * of a packed bdd, so that the optimizer can start with it.
 * Because the bdd is ordered, the state function of a node
 * always comes before the state functions of its child nodes.
 */
function getOrderingOfPackedBdd(packedBdd: PackedBdd): number[] {
    const nodeAmount = packedBdd.length / 3;
    const childLevels = orderedStateList.map(() => new Set<number>());
    for (let id = 0; id < nodeAmount; id++) {
        const level = packedBdd[id * 3];
        [packedBdd[id * 3 + 1], packedBdd[id * 3 + 2]].forEach(ref => {
            if (ref < nodeAmount) {
                childLevels[level].add(packedBdd[ref * 3]);
            }
        });
    }
    const parentAmount = orderedStateList.map(() => 0);
    childLevels.forEach(children => children.forEach(child => parentAmount[child]++));

    // topological sort, the position of state functions that the bdd never calls does not matter
    const ordering: number[] = [];
    const used = new Set<number>();
    while (ordering.length < orderedStateList.length) {
        const next = orderedStateList.findIndex(
            (_stateName, index) => !used.has(index) && parentAmount[index] === 0
        );
        used.add(next);
        ordering.push(next);
        childLevels[next].forEach(child => parentAmount[child]--);
    }
    return ordering;
}

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
                    60 // events
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
                            60 // events
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
                    (truthTable.keys().next().value as string).length,
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

                const packedBdd = bddToPackedBdd(bdd);
                ensurePackedBddMatchesTruthTable(packedBdd, loadTruthTable());
                writeBddTemplate(
                    packedBddToBase64String(packedBdd),
                    performanceMeasurement,
                    quality
                );

                console.log('nodes after minify: ' + bdd.countNodes());
            })();
            break;


        /**
         * Optimizes the bdd to become small and fast.
         * Finds the ordering of the state functions with the lowest expected
         * cpu time per resolve, deterministically and in seconds.
         * Saves the bdd when it is better than the current one.
         */
        case 'optimize-bdd':
            (async function optimizeBdd() {
                console.log('read table..');
                const truthTable = loadTruthTable();
                console.log('table size: ' + truthTable.size);

                // fill missing rows with unknown
                fillTruthTable(
                    truthTable,
                    (truthTable.keys().next().value as string).length,
                    unknownValueActionId
                );

                const optimizeState = JSON.parse(fs.readFileSync(BDD_OPTIMIZE_STATE_LOCATION, 'utf-8'));
                const performanceMeasurement: PerformanceMeasurement = optimizeState.performanceMeasurement;
                const currentPackedBdd = packedBddFromBase64String(optimizeState.packedBddString);

                console.log('count state set occurrences..');
                const stateSetOccurrences = countStateSetOccurrences(
                    getQueryVariations(),
                    getTestProcedures()
                );

                console.log('optimize ordering..');
                const result = await optimizeOrdering({
                    truthTable,
                    dontCareValue: unknownValueActionId,
                    // average runtime of each state function
                    functionCosts: orderedStateList.map(stateName => performanceMeasurement[stateName]),
                    /**
                     * State sets that occur often in the example queries
                     * should be cheap to resolve, but every known state set
                     * can occur in production.
                     */
                    rowWeight: (stateSet) => 1 + (stateSetOccurrences.get(stateSet) || 0),
                    initialOrderings: [
                        getOrderingOfPackedBdd(currentPackedBdd),
                        orderedStateList.map((_stateName, index) => index)
                    ],
                    onImprovement: ({ nodeCount, expectedCost, phase }) => {
                        console.log(phase + ': ' + nodeCount + ' nodes, expected cost ' + expectedCost);
                    }
                });
                console.dir({
                    ordering: result.ordering.map(index => orderedStateList[index]),
                    nodeCount: result.nodeCount,
                    expectedCost: result.expectedCost,
                    optimal: result.optimal,
                    stats: result.stats
                });

                const packedBdd = bddToPackedBdd(result.bdd);
                ensurePackedBddMatchesTruthTable(packedBdd, loadTruthTable());

                const quality = getQuality(result.bdd, performanceMeasurement);
                console.log('quality(new): ' + quality);
                console.log('quality(old): ' + optimizeState.quality);
                if (quality > optimizeState.quality) {
                    console.log('########## BETTER THEN BEFORE ! -> Save it');
                    writeBddTemplate(
                        packedBddToBase64String(packedBdd),
                        performanceMeasurement,
                        quality
                    );
                } else {
                    console.log('# DROP BECAUSE has better one with quality ' + optimizeState.quality);
                }
            })();
            break;

        /**
         * Runs the iterative-fuzzing in multiple processes.
         * The amount of processes can be given as argument,
         * by default it is one per cpu core, except one core
         * that is left free for the system.
         * Each process writes into its own log file
         * and is restarted when it exits.
         */
        case 'iterative-fuzzing-parallel':
            (function iterativeFuzzingParallel() {
                const cores = os.availableParallelism ? os.availableParallelism() : os.cpus().length;
                const amount = args[3] ? parseInt(args[3], 10) : Math.max(1, cores - 1);
                const logFolder = path.join(process.cwd(), 'fuzzing-logs');
                if (!fs.existsSync(logFolder)) {
                    fs.mkdirSync(logFolder);
                }
                const children = new Set<ReturnType<typeof spawn>>();
                let stopping = false;
                const startProcess = (nr: number) => {
                    const logFile = fs.openSync(path.join(logFolder, nr + '.log'), 'a');
                    const child = spawn(
                        process.execPath,
                        [...process.execArgv, process.argv[1], 'iterative-fuzzing'],
                        { stdio: ['ignore', logFile, logFile] }
                    );
                    children.add(child);
                    child.on('exit', (code) => {
                        children.delete(child);
                        fs.closeSync(logFile);
                        if (!stopping) {
                            console.log('fuzzing process ' + nr + ' exited with code ' + code + ', restarting');
                            setTimeout(() => startProcess(nr), 1000);
                        }
                    });
                };
                const stop = () => {
                    stopping = true;
                    children.forEach(child => child.kill());
                    process.exit(0);
                };
                process.on('SIGINT', stop);
                process.on('SIGTERM', stop);
                for (let nr = 0; nr < amount; nr++) {
                    startProcess(nr);
                }
                console.log('started ' + amount + ' fuzzing processes, logs are in ' + logFolder);
            })();
            break;

        default:
            throw new Error('no use for command ' + command);
    }

}

run();
