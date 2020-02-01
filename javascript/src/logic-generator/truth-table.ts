import * as fs from 'fs';
import * as path from 'path';

import { StateSetToActionMap, ActionName, StateSet } from '../types';
import { LOGIC_MAP_PATH } from './config';
import { KEY_VALUE_DELIMITER } from './generate-logic-map';
import { STATE_SET_LENGTH, oppositeBinary, decimalToPaddedBinary } from './binary-state';
import { replaceCharAt } from '../util';
import { orderedActionList } from '../actions';

export async function readTruthTable(): Promise<StateSetToActionMap> {
    const files = fs.readdirSync(
        LOGIC_MAP_PATH
    );

    const map: StateSetToActionMap = new Map();

    files.forEach(file => {
        const filePath = path.join(
            LOGIC_MAP_PATH,
            file
        );
        const content = fs.readFileSync(filePath, 'utf-8');
        const rows = content.split('\n');
        // remove last line because it is always a linebreak
        rows.pop();

        let lineNr = 0;
        rows.forEach(row => {
            lineNr++;
            const split = row.split(KEY_VALUE_DELIMITER);
            const state: StateSet = split[0];
            if (state && state.length === STATE_SET_LENGTH) {
                const action: ActionName = split[1] as ActionName;
                if (!orderedActionList.includes(action)) {
                    throw new Error(
                        'action not valid ' + orderedActionList +
                        'in file ' + filePath
                    );
                }
                map.set(state, action);
            } else {
                console.error('found not valid state at #' + lineNr + ' ' + filePath);
                console.log('state: ' + state);
            }
        });
    });

    // do some checks
    const mustBeSize = Math.pow(2, STATE_SET_LENGTH);
    if (map.size !== mustBeSize) {
        // value is missing, find it
        let x = 0;
        while (true) {
            const binary = decimalToPaddedBinary(x);
            if (!map.has(binary)) {
                throw new Error(
                    'readTruthTable(): some values must be missing, have ' +
                    map.size + ' not ' + mustBeSize + ' missing binary is ' + binary
                );
            }
            x++;
        }
    }

    return map;
}

export const NON_RELEVANT_FLAG = '-';


/**
 * flags non-relevant binaries
 * and returns a new truth-table
 * which should be smaller
 */
export function flagNonRelevant(
    truthTable: Map<string, string>,
    charIndex: number = 0,
    showLogs: boolean = false
): Map<string, string> {
    if (showLogs) {
        console.log('-'.repeat(22));
        console.log('flagNonRelevant(): ' + truthTable.size);
        console.log('-'.repeat(22));
    }
    const newMap: Map<string, string> = new Map();
    let flaggedCount = 0;

    let done = false;
    while (!done) {
        const key = truthTable.keys().next().value;
        if (!key) {
            done = true;
            break;
        }
        const value: string = truthTable.get(key) as string;
        const charValue = key[charIndex];
        const oppositeKey = replaceCharAt(key, charIndex, oppositeBinary(charValue));
        const oppositeValue: ActionName = truthTable.get(oppositeKey) as ActionName;

        // remove both from list
        truthTable.delete(key);
        truthTable.delete(oppositeKey);

        if (showLogs) {
            console.log('#'.repeat(20));
            console.log('charIndex: ' + charIndex);
            console.log('key: ' + key);
            console.log('value: ' + value);
            console.log('oppositeKey: ' + oppositeKey);
            console.log('oppositeValue: ' + oppositeValue);
        }

        if (value === oppositeValue) {
            flaggedCount++;
            const flaggedKey = replaceCharAt(key, charIndex, NON_RELEVANT_FLAG);
            if (showLogs) {
                console.log('both has same value, state is not relevant ' + flaggedKey);
            }
            newMap.set(flaggedKey, value);
        } else {
            if (showLogs) {
                console.log('not same value, we still need the state');
            }
            newMap.set(key, value);
            if (oppositeValue) {
                newMap.set(oppositeKey, oppositeValue);
            }
        }
    }

    return newMap;
}


/**
 * flags non-relevant binaries
 * and returns a new truth-table
 * which should be smaller
 */
export function flagNonRelevantOLD(
    truthTable: Map<string, string>,
    charIndex: number = 0,
    showLogs: boolean = false
): {
    flaggedCount: number,
    newMap: Map<string, string>
} {
    let newMap: Map<string, string> = new Map();
    let flaggedCount = 0;

    const firstKey = truthTable.keys().next().value;
    const stateSetLength = firstKey.length;

    // loop over each char
    for (let i = 0; i < stateSetLength; i++) {
        console.log('---------------------- char index ' + i);
        newMap = new Map();
        let x = 0;
        truthTable.forEach((value: string, key: string) => {
            x++;
            if (showLogs) {
                console.log('#'.repeat(20) + ' ' + x);
                console.log('i: ' + i);
                console.log('key: ' + key);
                console.log('value: ' + value);
            }
            const charValue = key[i];
            if (charValue === NON_RELEVANT_FLAG) {
                if (showLogs) {
                    console.log('key already flagged ' + key);
                }
                newMap.set(key, value);
            } else {
                const oppositeKey = replaceCharAt(key, i, oppositeBinary(charValue));
                const oppositeValue: ActionName = truthTable.get(oppositeKey) as ActionName;

                if (showLogs) {
                    console.log('oppositeKey: ' + oppositeKey);
                    console.log('oppositeValue: ' + oppositeValue);
                }
                if (value === oppositeValue) {
                    flaggedCount++;
                    const flaggedKey = replaceCharAt(key, i, NON_RELEVANT_FLAG);
                    if (showLogs) {
                        console.log('both has same value, state is not relevant ' + flaggedKey);
                    }
                    newMap.set(flaggedKey, value);
                    truthTable.delete(key);
                    truthTable.delete(oppositeKey);
                } else {
                    if (showLogs) {
                        console.log('not same value, we still need the state');
                    }
                    newMap.set(key, value);
                }
            }
        });
    }

    return {
        flaggedCount,
        newMap
    };
}