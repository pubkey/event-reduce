import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import Faker from 'faker';

import { StateSet } from '../types';

import {
    OUTPUT_FOLDER_PATH,
    OUTPUT_TRUTH_TABLE_PATH
} from './config';
import { getQueryVariations } from './queries';
import { getTestProcedures } from './procedures';
import { generateTruthTable } from '.';
import { mapToObject, objectToMap, readJsonFile, writeJsonFile, lastOfArray } from '../util';
import { fuzzing } from './fuzzing';
import { StateActionIdMap } from './types';
import { orderedActionList } from '../actions';


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
                    while (!fuzzingFoundError) {
                        console.log('run fuzzing()');


                        //                    const indexOfRunAgain = orderedActionList.indexOf('runFullQueryAgain');
                        //                      const map: StateActionIdMap = new Map();
                        //                        map.get = () => indexOfRunAgain;

                        const result = await fuzzing(
                            truthTable,
                            20, // queries
                            20 // events
                        );
                        if (result.ok === false) {
                            console.log('fuzzingFoundError');
                            fuzzingFoundError = true;
                            console.log(JSON.stringify(result.query));
                            console.log(JSON.stringify(lastOfArray(result.procedure)));
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

        default:
            throw new Error('no use for command ' + command);
    }

}

run();
