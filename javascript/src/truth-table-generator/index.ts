import deepEqual from 'deep-equal';

import type {
    StateActionIdMap,
    Procedure,
    Human
} from './types';
import type {
    QueryParams,
    ActionName,
    ActionFunctionInput,
    MongoQuery
} from '../types';
import {
    getMinimongoCollection,
    minimongoFind,
    applyChangeEvent,
    getQueryParamsByMongoQuery
} from './minimongo-helper';
import { runAction } from '../';
import { orderedActionList } from '../actions';
import { getStateSet } from '../states';

export interface GenerateTruthTableInput {
    queries: MongoQuery[];
    procedures: Procedure[];
    table?: StateActionIdMap;
    log?: boolean;
}

export async function generateTruthTable({
    queries,
    procedures,
    table = new Map(),
    log = false
}: GenerateTruthTableInput): Promise<StateActionIdMap> {

    let done = false;
    while (!done) {
        let totalChanges: number = 0;
        for (const procedure of procedures) {
            if (log) {
                console.log('generateTruthTable() next procedure with ' + procedure.length + ' events');
            }
            const changes = await incrementTruthTableActions(
                table,
                queries,
                procedure,
                log
            );
            totalChanges = totalChanges + changes;
        }
        if (totalChanges === 0) {
            done = true;
        }
    }

    return table;
}

export async function incrementTruthTableActions(
    table = new Map(),
    queries: MongoQuery[],
    procedure: Procedure,
    log: boolean = false
): Promise<number> {
    if (log) {
        console.log('incrementTruthTableActions()');
    }
    let changesCount = 0;

    const queryParamsByQuery: Map<MongoQuery, QueryParams<Human>> = new Map();
    queries.forEach(async (query) => {
        queryParamsByQuery.set(
            query,
            getQueryParamsByMongoQuery(query)
        );
    });
    const resultsBefore: Map<MongoQuery, Human[]> = new Map();
    queries.forEach(async (query) => {
        resultsBefore.set(query, []);
    });

    const collection = getMinimongoCollection();
    for (const changeEvent of procedure) {

        await applyChangeEvent(
            collection,
            changeEvent
        );

        // find action to generate after results
        for (const query of queries) {
            const params = queryParamsByQuery.get(query) as QueryParams<Human>;
            const before = resultsBefore.get(query) as Human[];
            const after = await minimongoFind(collection, query);
            const input: ActionFunctionInput<Human> = {
                changeEvent,
                previousResults: before.slice(),
                queryParams: params
            };
            const state = getStateSet(input);


            if (state === '10000000011000000') {
                console.log('!!');
                process.exit();
            }

            let currentActionId = table.get(state);
            if (!currentActionId) {
                table.set(state, 0);
                currentActionId = 0;
            }

            const nextWorking = getNextWorkingAction(
                input,
                after,
                currentActionId
            );

            resultsBefore.set(query, after);

            if (nextWorking !== currentActionId) {
                table.set(state, nextWorking);
                changesCount++;

                if (log) {
                    console.log(
                        'nextWorking() ' + state + ' - from ' +
                        orderedActionList[currentActionId] +
                        ' to ' + orderedActionList[nextWorking]
                    );
                }
            }
        }
    }

    return changesCount;
}

export function getNextWorkingAction(
    input: ActionFunctionInput<Human>,
    resultAfter: Human[],
    lastWorkingActionId: number,
    log: boolean = false
): number {
    let t = lastWorkingActionId;
    while (t <= orderedActionList.length) {
        const actionName = orderedActionList[t];
        const doesWork = doesActionWork(
            input,
            resultAfter,
            actionName,
            log
        );
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


/**
 * returns true if the action calculates the same
 * results as given
 */
export function doesActionWork(
    input: ActionFunctionInput<Human>,
    resultAfter: Human[],
    actionName: ActionName,
    log: boolean = false
) {
    if (actionName === 'runFullQueryAgain') {
        return true;
    }

    /*
    console.log('--- '.repeat(100));
    console.dir(input);
    console.dir(input.previousResults);
    console.dir(resultAfter);*/

    const calculatedResults = runAction(
        actionName,
        input.queryParams,
        input.changeEvent,
        input.previousResults.slice()
    );
    // console.dir(calculatedResults);

    if (
        // optimisation shortcut, this is faster because we know we have two arrays
        calculatedResults.length === resultAfter.length &&
        deepEqual(
            calculatedResults,
            resultAfter
        )
    ) {
        return true;
    } else {
        return false;
    }
}
