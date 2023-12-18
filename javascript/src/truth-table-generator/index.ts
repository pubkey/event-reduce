import { default as deepEqual } from 'deep-equal';

import type {
    StateActionIdMap,
    Procedure,
    Human
} from './types.js';
import type {
    QueryParams,
    ActionName,
    ActionFunctionInput,
    MongoQuery
} from '../types/index.js';
import { runAction } from '../index.js';
import { orderedActionList } from '../actions/index.js';
import { getStateSet } from '../states/index.js';
import { mingoCollectionCreator } from './database/mingo.js';
import { applyChangeEvent } from './database/index.js';

export * from './binary-state.js';
export * from './calculate-bdd-quality.js';
export * from './data-generator.js';
export * from './fuzzing.js';
export * from './procedures.js';
export * from './queries.js';
export type * from './types.js';
export * from './database/index.js';

export interface GenerateTruthTableInput {
    queries: MongoQuery[];
    procedures: Procedure[];
    table?: StateActionIdMap;
    log?: boolean;
}

export function generateTruthTable({
    queries,
    procedures,
    table = new Map(),
    log = false
}: GenerateTruthTableInput): StateActionIdMap {

    let done = false;
    while (!done) {
        let totalChanges: number = 0;
        for (const procedure of procedures) {
            if (log) {
                console.log('generateTruthTable() next procedure with ' + procedure.length + ' events');
            }
            const changes = incrementTruthTableActions(
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


export function incrementTruthTableActions(
    table = new Map(),
    queries: MongoQuery[],
    procedure: Procedure,
    log: boolean = false
): number {
    if (log) {
        console.log('incrementTruthTableActions()');
    }
    let changesCount = 0;

    const queryParamsByQuery: Map<MongoQuery, QueryParams<Human>> = new Map();

    const collection = mingoCollectionCreator();
    queries.forEach((query) => {
        queryParamsByQuery.set(
            query,
            collection.getQueryParams(query)
        );
    });
    const resultsBefore: Map<MongoQuery, Human[]> = new Map();
    queries.forEach((query) => {
        resultsBefore.set(query, []);
    });

    for (const changeEvent of procedure) {

        applyChangeEvent(
            collection,
            changeEvent
        );

        // find action to generate after results
        for (const query of queries) {
            const params = queryParamsByQuery.get(query) as QueryParams<Human>;
            const before = resultsBefore.get(query) as Human[];
            const after = collection.query(query);
            const input: ActionFunctionInput<Human> = {
                changeEvent,
                previousResults: before.slice(),
                queryParams: params
            };
            const state = getStateSet(input);

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

    const calculatedResults = runAction(
        actionName,
        input.queryParams,
        input.changeEvent,
        input.previousResults.slice()
    );

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
