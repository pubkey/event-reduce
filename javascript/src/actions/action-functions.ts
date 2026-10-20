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
 *
 * The input properties are destructured once at the top of each function
 * so that minifiers can rename the local variables and the long
 * property names only appear once per function in the bundle.
 */
function findIndexOfChangedDoc({ queryParams, changeEvent, previousResults, keyDocumentMap }: ActionFunctionInput<any>): number {
    const id = changeEvent.id;
    if (keyDocumentMap) {
        const docInMap = keyDocumentMap.get(id);
        if (docInMap) {
            const index = previousResults.indexOf(docInMap);
            if (index >= 0) {
                return index;
            }
        }
    }
    const primary = queryParams.primaryKey;
    for (let i = 0; i < previousResults.length; i++) {
        if (previousResults[i][primary] === id) {
            return i;
        }
    }
    return -1;
}

export const doNothing: ActionFunction<any> = (_input) => { };

export const insertFirst: ActionFunction<any> = ({ changeEvent, previousResults, keyDocumentMap }) => {
    previousResults.unshift(changeEvent.doc);
    if (keyDocumentMap) {
        keyDocumentMap.set(
            changeEvent.id,
            changeEvent.doc
        );
    }
};
export const insertLast: ActionFunction<any> = ({ changeEvent, previousResults, keyDocumentMap }) => {
    previousResults.push(changeEvent.doc);
    if (keyDocumentMap) {
        keyDocumentMap.set(
            changeEvent.id,
            changeEvent.doc
        );
    }
};
export const removeFirstItem: ActionFunction<any> = ({ queryParams, previousResults, keyDocumentMap }) => {
    const first = previousResults.shift();
    if (keyDocumentMap && first) {
        keyDocumentMap.delete(
            first[queryParams.primaryKey]
        );
    }
};

export const removeLastItem: ActionFunction<any> = ({ queryParams, previousResults, keyDocumentMap }) => {
    const last = previousResults.pop();
    if (keyDocumentMap && last) {
        keyDocumentMap.delete(
            last[queryParams.primaryKey]
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
    const { changeEvent, previousResults, keyDocumentMap } = input;
    const index = findIndexOfChangedDoc(input);
    if (keyDocumentMap) {
        keyDocumentMap.delete(
            changeEvent.id
        );
    }
    if (index >= 0) {
        previousResults.splice(index, 1);
    }
};

export const replaceExisting: ActionFunction<any> = (input) => {
    const { changeEvent, previousResults, keyDocumentMap } = input;
    const index = findIndexOfChangedDoc(input);
    if (index >= 0) {
        const doc = changeEvent.doc;
        previousResults[index] = doc;
        if (keyDocumentMap) {
            keyDocumentMap.set(
                changeEvent.id,
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
export const alwaysWrong: ActionFunction<any> = ({ previousResults, keyDocumentMap }) => {
    const wrongHuman = {
        _id: 'wrongHuman' + new Date().getTime()
    };
    previousResults.length = 0; // clear array
    previousResults.push(wrongHuman);
    if (keyDocumentMap) {
        keyDocumentMap.clear();
        keyDocumentMap.set(
            wrongHuman._id,
            wrongHuman
        );
    }
};

export const insertAtSortPosition: ActionFunction<any> = ({ queryParams, changeEvent, previousResults, keyDocumentMap }) => {
    const docId = changeEvent.id;
    const doc = changeEvent.doc;
    if (keyDocumentMap) {

        if (keyDocumentMap.has(docId)) {
            /**
             * If document is already in results,
             * we cannot add it again because it would throw on non-deterministic ordering.
             */
            return;
        }

        keyDocumentMap.set(
            docId,
            doc
        );
    } else {
        const primaryKey = queryParams.primaryKey;
        const isDocInResults = previousResults.find((d: any) => d[primaryKey] === docId);
        /**
         * If document is already in results,
         * we cannot add it again because it would throw on non-deterministic ordering.
         */
        if (isDocInResults) {
            return;
        }
    }

    pushAtSortPosition(
        previousResults,
        doc,
        queryParams.sortComparator,
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
