import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import {
    spawn, ChildProcessWithoutNullStreams
} from 'child_process';

import {
    binaryToDecimal,
    LAST_STATE_SET,
    decimalToPaddedBinary,
    STATE_SET_LENGTH
} from './binary-state';
import { StateSet } from '../types';
import { generateLogicMap } from './generate-logic-map';
import { LOGIC_MAP_PATH, VALID_STATE_SET_PATH } from './config';
import { readTruthTable, flagNonRelevant } from './truth-table';
import { findValidStates } from './find-valid-states';

declare interface Batch {
    childId: number;
    fromState: StateSet;
    endState: StateSet;
    childArgs: string[];
}

const childProcesses: ChildProcessWithoutNullStreams[] = [];

function startBatch(batch: Batch, batches: Batch[]) {
    const childId = batch.childId;
    console.log('startBatch() #' + childId);
    const childProcess = spawn('ts-node', batch.childArgs);
    childProcesses.push(childProcess);
    childProcess.stdout.on('data', (data: any) => {
        console.log('#' + childId + ': ' + data.toString().trim());
    });
    childProcess.stderr.on('data', (data: any) => {
        console.error('ERROR: got fatal error with input ' + batch.fromState + ' ' + batch.endState);
        console.error('#' + childId + ': ' + data.toString().trim());

        // kill all child processes, then exit
        childProcesses.forEach(c => c.kill('SIGINT'));
        process.exit(1);
    });

    childProcess.on('exit', function () {
        console.log('#'.repeat(100));
        console.log('child process exited (#' + childId + '): ' + batch.fromState + ' ' + batch.endState);
        console.log('# missing batches: ' + batches.length);
        console.log('#'.repeat(100));

        const nextBatch = batches.pop();
        if (nextBatch) {
            startBatch(nextBatch, batches);
        }
    });
}

async function run() {

    if (!fs.existsSync(LOGIC_MAP_PATH)) {
        fs.mkdirSync(LOGIC_MAP_PATH);
    }

    const args = process.argv;
    const command = args[2];
    console.log('run command: ' + command);
    console.log(__filename);

    switch (command) {
        case 'find-valid-state-sets':
            const states = await findValidStates();
            const saveJson = Array.from(states);
            fs.writeFileSync(
                VALID_STATE_SET_PATH,
                JSON.stringify(saveJson, null, 2),
                { encoding: 'utf8', flag: 'w' }
            );
            console.log('found ' + states.size + ' different states');
            break;
        case 'logic-map':
            // one process does not full-block the CPU (only about 33% of an i7)
            // so use a higher number then the amount of CPUs
            const parallel = os.cpus().length * 3;
            const batchesAmount = parallel * 20;

            let lastBatch = binaryToDecimal(LAST_STATE_SET);
            const batchSize = Math.ceil(lastBatch / batchesAmount);

            let id = 0;
            const batches: Batch[] = new Array(batchesAmount).fill(0)
                .map(() => {
                    const childId = id;
                    id++;
                    const endState: StateSet = decimalToPaddedBinary(lastBatch);
                    lastBatch = lastBatch - batchSize;
                    if (lastBatch < 0) {
                        lastBatch = 0;
                    }
                    const fromState: StateSet = decimalToPaddedBinary(lastBatch);

                    return {
                        childId,
                        fromState,
                        endState,
                        childArgs: [
                            __filename,
                            'logic-map-child',
                            fromState,
                            endState
                        ]
                    };
                });
            new Array(parallel).fill(0).forEach(async () => {
                const batch = batches.pop() as Batch;
                startBatch(batch, batches);
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
