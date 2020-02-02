import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import {
    spawn
} from 'child_process';

import {
    binaryToDecimal,
    LAST_STATE_SET,
    decimalToPaddedBinary,
    STATE_SET_LENGTH
} from './binary-state';
import { StateSet } from '../types';
import { generateLogicMap } from './generate-logic-map';
import { LOGIC_MAP_PATH } from './config';
import { readTruthTable, flagNonRelevant } from './truth-table';

async function run() {

    const args = process.argv;
    const command = args[2];
    console.log('run command: ' + command);
    console.log(__filename);

    switch (command) {
        case 'logic-map':
            if (!fs.existsSync(LOGIC_MAP_PATH)) {
                fs.mkdirSync(LOGIC_MAP_PATH);
            }

            // one process does not full-block the CPU (only about 33% of an i7)
            // so use a higher number then the amount of CPUs
            const processes = os.cpus().length * 4;

            let lastBatch = binaryToDecimal(LAST_STATE_SET);
            const batchSize = Math.ceil(lastBatch / processes);

            let id = 0;
            let runningChilds: number[] = [];
            new Array(processes).fill(0).forEach(() => {
                const childId = id;
                runningChilds.push(childId);
                id++;
                const endState: StateSet = decimalToPaddedBinary(lastBatch);
                lastBatch = lastBatch - batchSize;
                if (lastBatch < 0) {
                    lastBatch = 0;
                }
                const fromState: StateSet = decimalToPaddedBinary(lastBatch);

                const childCommand = [
                    'ts-node',
                    __filename,
                    'logic-map-child',
                    fromState,
                    endState
                ].join(' ');
                console.log('childCommand: ' + childCommand);
                const childProcess = spawn('ts-node', [
                    __filename,
                    'logic-map-child',
                    fromState,
                    endState
                ]);

                childProcess.stdout.on('data', (data: any) => {
                    console.log('#' + childId + ': ' + data.toString().trim());
                });
                childProcess.stderr.on('data', (data: any) => {
                    console.error('#' + childId + ': ' + data.toString().trim());
                });

                childProcess.on('exit', function () {
                    console.log('#'.repeat(10));
                    console.log('child process exited (#' + childId + '): ' + childCommand);
                    runningChilds = runningChilds.filter(i => i !== childId);
                    console.log('still running: ' + runningChilds.join(', '));
                    console.log('#'.repeat(10));
                });
            });
            break;
        case 'logic-map-child':
            const startStateSet: StateSet = args[3];
            const endStateSet: StateSet = args[4];
            const logicMapFilePath = path.join(
                LOGIC_MAP_PATH,
                startStateSet + '.txt'
            );
            await generateLogicMap(
                logicMapFilePath,
                startStateSet,
                endStateSet,
                200 // amount of random changeEvents per test
            );
            break;
        case 'flag-non-relevant':
            let truthTable = await readTruthTable();
            console.log('start map size: ' + truthTable.size);

            let i = STATE_SET_LENGTH;
            while (i > 0) {
                i--;
                const flaggedResult = flagNonRelevant(truthTable, i);
                truthTable = flaggedResult as any;
                console.log('got new truth table:');
                console.log('new map size: ' + truthTable.size);
            }

            truthTable.forEach((value: string, key: string) => {
                console.log(key + ': ' + value);
            });
            console.log('got new truth table:');
            console.log('new map size: ' + truthTable.size);
            break;
        default:
            throw new Error('no use for command ' + command);
    }

}

run();
