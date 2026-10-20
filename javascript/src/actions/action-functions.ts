import {
    pushAtSortPosition
} from 'array-push-at-sort-position';

import type { ActionFunction, InternalFunction, InternalInput } from '../types/index.js';
import { toPublicFunction } from '../util.js';

/**
 * The action functions are implemented on the positional InternalInput
 * so that minifiers can rename the input variables
 * and the long property names do not end up in the bundle.
 */
type InternalActionFunction = InternalFunction<any, void>;

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
function findIndexOfChangedDoc([queryParams, changeEvent, previousResults, keyDocumentMap]: InternalInput<any>): number {
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

const doNothingInternal: InternalActionFunction = () => { };

const insertFirstInternal: InternalActionFunction = ([, changeEvent, previousResults, keyDocumentMap]) => {
    previousResults.unshift(changeEvent.doc);
    if (keyDocumentMap) {
        keyDocumentMap.set(
            changeEvent.id,
            changeEvent.doc
        );
    }
};
const insertLastInternal: InternalActionFunction = ([, changeEvent, previousResults, keyDocumentMap]) => {
    previousResults.push(changeEvent.doc);
    if (keyDocumentMap) {
        keyDocumentMap.set(
            changeEvent.id,
            changeEvent.doc
        );
    }
};
const removeFirstItemInternal: InternalActionFunction = ([queryParams, , previousResults, keyDocumentMap]) => {
    const first = previousResults.shift();
    if (keyDocumentMap && first) {
        keyDocumentMap.delete(
            first[queryParams.primaryKey]
        );
    }
};

const removeLastItemInternal: InternalActionFunction = ([queryParams, , previousResults, keyDocumentMap]) => {
    const last = previousResults.pop();
    if (keyDocumentMap && last) {
        keyDocumentMap.delete(
            last[queryParams.primaryKey]
        );
    }
};

const removeFirstInsertLastInternal: InternalActionFunction = (input) => {
    removeFirstItemInternal(input);
    insertLastInternal(input);
};

const removeLastInsertFirstInternal: InternalActionFunction = (input) => {
    removeLastItemInternal(input);
    insertFirstInternal(input);
};

const removeFirstInsertFirstInternal: InternalActionFunction = (input) => {
    removeFirstItemInternal(input);
    insertFirstInternal(input);
};

const removeLastInsertLastInternal: InternalActionFunction = (input) => {
    removeLastItemInternal(input);
    insertLastInternal(input);
};

const removeExistingInternal: InternalActionFunction = (input) => {
    const [, changeEvent, previousResults, keyDocumentMap] = input;
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

const replaceExistingInternal: InternalActionFunction = (input) => {
    const [, changeEvent, previousResults, keyDocumentMap] = input;
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
const alwaysWrongInternal: InternalActionFunction = ([, , previousResults, keyDocumentMap]) => {
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

const insertAtSortPositionInternal: InternalActionFunction = ([queryParams, changeEvent, previousResults, keyDocumentMap]) => {
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

const removeExistingAndInsertAtSortPositionInternal: InternalActionFunction = (input) => {
    removeExistingInternal(input);
    insertAtSortPositionInternal(input);
};

const runFullQueryAgainInternal: InternalActionFunction = () => {
    throw new Error('EventReduce:RUN_FULL');
};

const unknownActionInternal: InternalActionFunction = () => {
    throw new Error('EventReduce:UNK_ACT');
};

/**
 * The internal action functions in the same order as orderedActionList.
 */
export const internalActionFunctions: InternalActionFunction[] = [
    doNothingInternal,
    insertFirstInternal,
    insertLastInternal,
    removeFirstItemInternal,
    removeLastItemInternal,
    removeFirstInsertLastInternal,
    removeLastInsertFirstInternal,
    removeFirstInsertFirstInternal,
    removeLastInsertLastInternal,
    removeExistingInternal,
    replaceExistingInternal,
    alwaysWrongInternal,
    insertAtSortPositionInternal,
    removeExistingAndInsertAtSortPositionInternal,
    runFullQueryAgainInternal,
    unknownActionInternal
];

export const doNothing: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(doNothingInternal);
export const insertFirst: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(insertFirstInternal);
export const insertLast: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(insertLastInternal);
export const removeFirstItem: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(removeFirstItemInternal);
export const removeLastItem: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(removeLastItemInternal);
export const removeFirstInsertLast: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(removeFirstInsertLastInternal);
export const removeLastInsertFirst: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(removeLastInsertFirstInternal);
export const removeFirstInsertFirst: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(removeFirstInsertFirstInternal);
export const removeLastInsertLast: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(removeLastInsertLastInternal);
export const removeExisting: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(removeExistingInternal);
export const replaceExisting: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(replaceExistingInternal);
export const alwaysWrong: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(alwaysWrongInternal);
export const insertAtSortPosition: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(insertAtSortPositionInternal);
export const removeExistingAndInsertAtSortPosition: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(removeExistingAndInsertAtSortPositionInternal);
export const runFullQueryAgain: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(runFullQueryAgainInternal);
export const unknownAction: ActionFunction<any> = /* @__PURE__ */ toPublicFunction(unknownActionInternal);
