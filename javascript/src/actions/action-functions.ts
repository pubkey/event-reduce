import {
    pushAtSortPosition
} from 'array-push-at-sort-position';

import type { ActionFunction, ActionFunctionInput } from '../types/index.js';

/**
 * Returns the index of the changed document inside of the previous results
 * or -1 if it is not found.
 *
 * When a keyDocumentMap is given, we get the document reference from the map
 * and use the native indexOf(), which is about 10x faster than
 * comparing the primary key of each result item in a loop.
 * If the map holds a different object reference than the results array
 * (for example because the caller built the map from clones),
 * we fall back to the primary key comparison.
 */
function findIndexOfChangedDoc(input: ActionFunctionInput<any>): number {
    const id = input.changeEvent.id;
    const results = input.previousResults;
    if (input.keyDocumentMap) {
        const docInMap = input.keyDocumentMap.get(id);
        if (docInMap) {
            const index = results.indexOf(docInMap);
            if (index >= 0) {
                return index;
            }
        }
    }
    const primary = input.queryParams.primaryKey;
    for (let i = 0; i < results.length; i++) {
        if (results[i][primary] === id) {
            return i;
        }
    }
    return -1;
}

export const doNothing: ActionFunction<any> = (_input) => { };

export const insertFirst: ActionFunction<any> = (input) => {
    input.previousResults.unshift(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(
            input.changeEvent.id,
            input.changeEvent.doc
        );
    }
};
export const insertLast: ActionFunction<any> = (input) => {
    input.previousResults.push(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(
            input.changeEvent.id,
            input.changeEvent.doc
        );
    }
};
export const removeFirstItem: ActionFunction<any> = (input) => {
    const first = input.previousResults.shift();
    if (input.keyDocumentMap && first) {
        input.keyDocumentMap.delete(
            first[input.queryParams.primaryKey]
        );
    }
};

export const removeLastItem: ActionFunction<any> = (input) => {
    const last = input.previousResults.pop();
    if (input.keyDocumentMap && last) {
        input.keyDocumentMap.delete(
            last[input.queryParams.primaryKey]
        );
    }
};

export const removeFirstInsertLast: ActionFunction<any> = (input) => {
    removeFirstItem(input);
    insertLast(input);
};

export const removeLastInsertFirst: ActionFunction<any> = (input) => {
    removeLastItem(input);
    insertFirst(input);
};

export const removeFirstInsertFirst: ActionFunction<any> = (input) => {
    removeFirstItem(input);
    insertFirst(input);
};

export const removeLastInsertLast: ActionFunction<any> = (input) => {
    removeLastItem(input);
    insertLast(input);
};

export const removeExisting: ActionFunction<any> = (input) => {
    const index = findIndexOfChangedDoc(input);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.delete(
            input.changeEvent.id
        );
    }
    if (index >= 0) {
        input.previousResults.splice(index, 1);
    }
};

export const replaceExisting: ActionFunction<any> = (input) => {
    const index = findIndexOfChangedDoc(input);
    if (index >= 0) {
        const doc = input.changeEvent.doc;
        input.previousResults[index] = doc;
        if (input.keyDocumentMap) {
            input.keyDocumentMap.set(
                input.changeEvent.id,
                doc
            );
        }
    }
};

/**
 * this function always returns wrong results
 * it must be later optimised out
 * otherwise there is something broken
 */
export const alwaysWrong: ActionFunction<any> = (input) => {
    const wrong = {
        _id: 'wrong' + new Date().getTime()
    };
    input.previousResults.length = 0; // clear array
    input.previousResults.push(wrong);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.clear();
        input.keyDocumentMap.set(
            wrong._id,
            wrong
        );
    }
};

export const insertAtSortPosition: ActionFunction<any> = (input) => {
    const docId = input.changeEvent.id;
    const doc = input.changeEvent.doc;
    if (input.keyDocumentMap) {

        if (input.keyDocumentMap.has(docId)) {
            /**
             * If document is already in results,
             * we cannot add it again because it would throw on non-deterministic ordering.
             */
            return;
        }

        input.keyDocumentMap.set(
            docId,
            doc
        );
    } else {
        const isDocInResults = input.previousResults.find((d: any) => d[input.queryParams.primaryKey] === docId);
        /**
         * If document is already in results,
         * we cannot add it again because it would throw on non-deterministic ordering.
         */
        if (isDocInResults) {
            return;
        }
    }

    pushAtSortPosition(
        input.previousResults,
        doc,
        input.queryParams.sortComparator,
        0
    );
};

export const removeExistingAndInsertAtSortPosition: ActionFunction<any> = (input) => {
    removeExisting(input);
    insertAtSortPosition(input);
};

export const runFullQueryAgain: ActionFunction<any> = (_input) => {
    throw new Error('EventReduce:RUN_FULL');
};

export const unknownAction: ActionFunction<any> = (_input) => {
    throw new Error('EventReduce:UNK_ACT');
};
