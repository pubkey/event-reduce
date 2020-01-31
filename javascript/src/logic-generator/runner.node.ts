import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import {
    spawn,
    exec
} from 'child_process';

import {
    binaryToDecimal,
    LAST_STATE_SET,
    decimalToPaddedBinary
} from './binary-state';
import { StateSet } from '../types';
import { generateLogicMap } from './generate-logic-map';

export const LOGIC_MAP_PATH = path.join(
    __dirname,
    'logic-map-output'
);

const MODULE_BASE_PATH = path.join(
    __dirname,
    '../../'
);

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

            // one process does not full-block the CPU
            // so use a higher number then the amount of CPUs
            const processes = os.cpus().length * 3;

            let lastBatch = binaryToDecimal(LAST_STATE_SET);
            const batchSize = Math.ceil(lastBatch / processes);

            let id = 0;
            new Array(processes).fill(0).forEach(() => {
                const childId = id;
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
                endStateSet
            );
            break;
        default:
            throw new Error('no use for command ' + command);
            break;
    }

}

run();
