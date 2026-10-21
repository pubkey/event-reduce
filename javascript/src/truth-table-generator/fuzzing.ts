import type {
    QueryParams,
    ActionFunctionInput,
    ChangeEvent,
    ActionName,
    MongoQuery
} from '../types/index.js';
import type {
    Procedure,
    StateActionIdMap,
    Human
} from './types.js';
import { randomQuery } from './queries.js';
import { randomChangeHuman, randomHuman } from './data-generator.js';
import { getStateSet } from '../states/index.js';
import { orderedActionList } from '../actions/index.js';
import { doesActionWork } from './index.js';
import { mingoCollectionCreator } from './database/mingo.js';
import { applyChangeEvent } from './database/index.js';
import type { Collection } from './database/index.js';
import { randomOfArray } from '../util.js';
import { randomString } from 'async-test-util';

export type FuzzingReturn = {
    ok: boolean,
    query: MongoQuery,
    procedure: Procedure,
    amountOfHandled: number,
    amountOfOptimized: number
};

/**
 * randomly generates queries and events
 * and returns on the first broken one
 *
 * returns ok:true if no problem was found
 */
export function fuzzing(
    table: StateActionIdMap,
    queriesAmount: number = 30,
    eventsAmount: number = 100
): FuzzingReturn {
    let amountOfHandled = 0;
    let amountOfOptimized = 0;

    const queries: MongoQuery[] = new Array(queriesAmount)
        .fill(0)
        .map(() => randomQuery());

    const queryParamsByQuery: Map<MongoQuery, QueryParams<Human>> = new Map();
    const collection = mingoCollectionCreator();
    queries.forEach(query => {
        queryParamsByQuery.set(
            query,
            collection.getQueryParams(query)
        );
    });

    const usedChangeEvents: ChangeEvent<Human>[] = [];
    for (let eventNr = 0; eventNr < eventsAmount; eventNr++) {
        const changeEvent = randomFuzzingChangeEvent(
            collection,
            queries,
            eventNr / eventsAmount
        );
        usedChangeEvents.push(changeEvent);

        // get previous results
        const resultsBefore: Map<MongoQuery, Human[]> = new Map();
        queries.forEach(query => {
            const res = collection.query(query);
            resultsBefore.set(query, res);
        });

        applyChangeEvent(
            collection,
            changeEvent
        );

        // get results after event
        const resultsAfter: Map<MongoQuery, Human[]> = new Map();
        queries.forEach(query => {
            const res = collection.query(query);
            resultsAfter.set(query, res);
        });

        // find action to generate after results
        for (const query of queries) {
            const params = queryParamsByQuery.get(query) as QueryParams<Human>;
            const previousResults = resultsBefore.get(query) as Human[];
            const after = resultsAfter.get(query) as Human[];
            const input: ActionFunctionInput<Human> = {
                changeEvent,
                previousResults,
                queryParams: params
            };
            const state = getStateSet(input);
            const actionId = table.get(state);

            let ok: boolean;
            if (typeof actionId !== 'number') {
                ok = false;
            } else {
                const action: ActionName = orderedActionList[actionId];
                amountOfHandled++;
                if (action !== 'runFullQueryAgain') {
                    amountOfOptimized++;
                }
                ok = doesActionWork(
                    input,
                    after,
                    action
                );
            }
            if (!ok) {
                return {
                    ok: false,
                    query,
                    procedure: shrinkProcedure(table, query, usedChangeEvents),
                    amountOfHandled,
                    amountOfOptimized
                };
            }
        }
    }

    return {
        ok: true,
        query: queries[0],
        procedure: usedChangeEvents,
        amountOfHandled,
        amountOfOptimized
    };
}

/**
 * Returns a random change event for the current state of the collection.
 * Half of the events are aimed at the edges of the result window of one of the queries,
 * because these are the events where most actions differ.
 * The other half are random events. These first grow the collection,
 * then mostly update documents and in the end remove documents,
 * depending on the progress (0 to 1) of the procedure.
 */
export function randomFuzzingChangeEvent(
    collection: Collection,
    queries: MongoQuery[],
    progress: number
): ChangeEvent<Human> {
    const allDocs: Human[] = collection.query({ selector: {}, sort: ['_id'] });
    if (allDocs.length > 0 && Math.random() < 0.5) {
        const event = windowEdgeChangeEvent(collection, randomOfArray(queries), allDocs);
        if (event) {
            return event;
        }
    }

    let operations: ChangeEvent<Human>['operation'][];
    if (progress < 0.5) {
        operations = ['INSERT', 'INSERT', 'INSERT', 'INSERT', 'UPDATE', 'UPDATE', 'UPDATE', 'DELETE'];
    } else if (progress < 0.8) {
        operations = ['INSERT', 'UPDATE', 'UPDATE', 'UPDATE', 'UPDATE', 'UPDATE', 'UPDATE', 'DELETE'];
    } else {
        operations = ['INSERT', 'UPDATE', 'UPDATE', 'UPDATE', 'DELETE', 'DELETE', 'DELETE', 'DELETE'];
    }
    const operation = allDocs.length === 0 ? 'INSERT' : randomOfArray(operations);
    switch (operation) {
        case 'INSERT':
            const newDoc = randomHuman();
            return {
                operation,
                id: newDoc._id,
                doc: newDoc,
                previous: null
            };
        case 'UPDATE':
            const oldDoc = randomOfArray(allDocs);
            return {
                operation,
                id: oldDoc._id,
                doc: randomChangeHuman(oldDoc),
                previous: oldDoc
            };
        case 'DELETE':
            const docToDelete = randomOfArray(allDocs);
            return {
                operation,
                id: docToDelete._id,
                doc: null,
                previous: docToDelete
            };
    }
}

/**
 * Returns an event that inserts, moves or removes a document
 * right next to the first or last document of the result window,
 * next to the skipped documents or in the middle of the window.
 * Copying all fields except the _id of an anchor document
 * makes the changed document sort directly next to the anchor,
 * because all sortings end with the _id.
 */
function windowEdgeChangeEvent(
    collection: Collection,
    query: MongoQuery,
    allDocs: Human[]
): ChangeEvent<Human> | undefined {
    const matching: Human[] = collection.query({ selector: query.selector, sort: query.sort });
    if (matching.length === 0) {
        return undefined;
    }
    const skip = query.skip ? query.skip : 0;
    const windowSize = Math.max(1, Math.min(query.limit ? query.limit : Infinity, matching.length - skip));
    const positions = [
        0,
        skip - 1,
        skip,
        skip + 1,
        skip + Math.floor(windowSize / 2),
        skip + windowSize - 2,
        skip + windowSize - 1,
        skip + windowSize,
        matching.length - 1
    ].filter(position => position >= 0 && position < matching.length);
    const randomEdgeDoc = () => matching[randomOfArray(positions)];
    const anchor = randomEdgeDoc();
    const copyOfAnchor = (id: string): Human => Object.assign({}, anchor, { _id: id });

    const random = Math.random();
    if (random < 0.3) {
        // the appended string makes it sort directly after the anchor when sorted by _id only
        const id = anchor._id + randomString(3);
        if (allDocs.find(doc => doc._id === id)) {
            return undefined;
        }
        return {
            operation: 'INSERT',
            id,
            doc: copyOfAnchor(id),
            previous: null
        };
    } else if (random < 0.9) {
        // mostly move a document of the window edges, sometimes one that did not match before
        const mover = Math.random() < 0.8 ? randomEdgeDoc() : randomOfArray(allDocs);
        const doc = mover._id === anchor._id ? randomChangeHuman(mover) : copyOfAnchor(mover._id);
        return {
            operation: 'UPDATE',
            id: mover._id,
            doc,
            previous: mover
        };
    } else {
        return {
            operation: 'DELETE',
            id: anchor._id,
            doc: null,
            previous: anchor
        };
    }
}

/**
 * Returns true if the procedure reaches a state set
 * that is not in the table or whose action returns wrong results.
 */
export function doesProcedureFail(
    table: StateActionIdMap,
    query: MongoQuery,
    procedure: Procedure
): boolean {
    const collection = mingoCollectionCreator();
    const queryParams = collection.getQueryParams(query);
    for (const changeEvent of procedure) {
        const previousResults = collection.query(query);
        applyChangeEvent(collection, changeEvent);
        const input: ActionFunctionInput<Human> = {
            changeEvent,
            previousResults,
            queryParams
        };
        const actionId = table.get(getStateSet(input));
        if (
            typeof actionId !== 'number' ||
            !doesActionWork(input, collection.query(query), orderedActionList[actionId])
        ) {
            return true;
        }
    }
    return false;
}

/**
 * Makes the change events consistent again after some events were removed.
 * Drops inserts of existing documents and updates or deletes of missing documents,
 * and sets the previous document of updates and deletes to the current one.
 */
function makeProcedureConsistent(procedure: Procedure): Procedure {
    const docs = new Map<string, Human>();
    const ret: Procedure = [];
    for (const changeEvent of procedure) {
        const current = docs.get(changeEvent.id);
        if (changeEvent.operation === 'INSERT') {
            if (!current) {
                docs.set(changeEvent.id, changeEvent.doc);
                ret.push(changeEvent);
            }
        } else if (current) {
            if (changeEvent.operation === 'UPDATE') {
                docs.set(changeEvent.id, changeEvent.doc);
                ret.push(Object.assign({}, changeEvent, { previous: current }));
            } else {
                docs.delete(changeEvent.id);
                ret.push(Object.assign({}, changeEvent, { previous: current }));
            }
        }
    }
    return ret;
}

/**
 * Removes as many change events as possible while the procedure still fails,
 * so that the stored procedures stay small and are fast to replay
 * when the truth table is generated again.
 */
export function shrinkProcedure(
    table: StateActionIdMap,
    query: MongoQuery,
    procedure: Procedure
): Procedure {
    let current = procedure;
    let chunkSize = Math.max(1, Math.floor(current.length / 2));
    while (chunkSize >= 1) {
        let removedSome = false;
        for (let start = current.length - chunkSize; start >= 0; start = start - chunkSize) {
            const candidate = makeProcedureConsistent(
                current.slice(0, start).concat(current.slice(start + chunkSize))
            );
            if (candidate.length < current.length && doesProcedureFail(table, query, candidate)) {
                current = candidate;
                removedSome = true;
            }
        }
        if (!removedSome) {
            chunkSize = Math.floor(chunkSize / 2);
        }
    }
    return current;
}
