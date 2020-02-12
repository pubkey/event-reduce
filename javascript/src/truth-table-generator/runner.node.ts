import * as fs from 'fs';

import {
    OUTPUT_FOLDER_PATH,
    OUTPUT_TRUTH_TABLE_PATH
} from './config';
import { getQueryVariations } from './queries';
import { getTestProcedures } from './procedures';
import { generateTruthTable } from '.';
import {
    mapToObject,
    objectToMap, readJsonFile,
    writeJsonFile, lastOfArray
} from '../util';
import { fuzzing } from './fuzzing';
import { StateActionIdMap } from './types';
import { orderedActionList } from '../actions';
import { createBddFromTruthTable, TruthTable } from '../bdd';
import { fillTruthTable } from '../bdd/fill-truth-table';
import { ActionName } from '../types';
import { optimizeBruteForce } from '../bdd/optimize-brute-force';
import { RootNode } from '../bdd/root-node';

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
            (async function gennerate() {
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
                const result = await fuzzing(
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
        case 'itterative-fuzzing':
            (async function itterativeFuzzing() {
                const truthTable: StateActionIdMap = objectToMap(
                    readJsonFile(OUTPUT_TRUTH_TABLE_PATH)
                );
                const queries = getQueryVariations();
                const procedures = getTestProcedures();
                while (true) {

                    let fuzzingFoundError = false;
                    let fuzzingCount = 0;
                    while (!fuzzingFoundError) {
                        fuzzingCount++;
                        console.log('run fuzzing() #' + fuzzingCount);


                        //                    const indexOfRunAgain = orderedActionList.indexOf('runFullQueryAgain');
                        //                      const map: StateActionIdMap = new Map();
                        //                        map.get = () => indexOfRunAgain;

                        const result = await fuzzing(
                            truthTable,
                            40, // queries
                            20 // events
                        );
                        if (result.ok === false) {
                            console.log('fuzzingFoundError');
                            fuzzingFoundError = true;
                            console.log(JSON.stringify(result.query));
                            console.log(
                                result.procedure.length + ' ' +
                                JSON.stringify(lastOfArray(result.procedure))
                            );
                            queries.push(result.query);
                            procedures.push(result.procedure);
                        }
                    }

                    // update table with fuzzing result
                    await generateTruthTable({
                        table: truthTable,
                        queries,
                        procedures,
                        log: true
                    });

                    console.log('saving table to json');
                    const tableObject = mapToObject(truthTable);
                    writeJsonFile(
                        OUTPUT_TRUTH_TABLE_PATH,
                        tableObject
                    );
                }
            })();
            break;

        case 'create-bdd':
            (async function createBdd() {
                const unknownValue: ActionName = 'unknownAction';
                console.log('read table..');
                const truthTable: TruthTable = objectToMap(
                    readJsonFile(OUTPUT_TRUTH_TABLE_PATH)
                );
                console.log('table size: ' + truthTable.size);

                // replace actionId with actionName
                for (const [key, value] of truthTable.entries()) {
                    const actionName = orderedActionList[value];
                    truthTable.set(key, actionName);
                }

                // fill missing rows with unknown
                fillTruthTable(
                    truthTable,
                    truthTable.keys().next().value.length,
                    unknownValue
                );

                console.log('create bdd..');
                const bdd = createBddFromTruthTable(truthTable);
                console.log('mimizing..');
                console.log('remove unkown states..');
                bdd.removeIrrelevantLeafNodes(unknownValue);

                bdd.log();
                console.log('nodes after minify: ' + bdd.countNodes());
            })();
            break;
        case 'optimize-bdd':
            (async function optimizeBdd() {
                const unknownValue: ActionName = 'unknownAction';
                console.log('read table..');
                const truthTable: TruthTable = objectToMap(
                    readJsonFile(OUTPUT_TRUTH_TABLE_PATH)
                );
                console.log('table size: ' + truthTable.size);

                // replace actionId with actionName
                for (const [key, value] of truthTable.entries()) {
                    const actionName = orderedActionList[value];
                    truthTable.set(key, actionName);
                }

                // fill missing rows with unknown
                fillTruthTable(
                    truthTable,
                    truthTable.keys().next().value.length,
                    unknownValue
                );

                optimizeBruteForce({
                    truthTable,
                    itterations: 10000,
                    afterBddCreation: (bdd: RootNode) => {
                        bdd.removeIrrelevantLeafNodes(unknownValue);
                    }
                });
            })();
            break;

        default:
            throw new Error('no use for command ' + command);
    }

}

run();
