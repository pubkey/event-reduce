import {
    pushAtSortPosition
} from 'array-push-at-sort-position';
import { ActionFunction } from '../types';
import { STATIC_RANDOM_HUMAN } from '../logic-generator/data-generator';

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


export const removeExisting: ActionFunction<any> = (input) => {
    if (input.keyDocumentMap) {
        input.keyDocumentMap.delete(
            input.changeEvent.id
        );
    }

    // find index of document
    const primary = input.queryParams.primaryKey;
    const results = input.previousResults;
    for (let i = 0; i < results.length; i++) {
        const item = results[i];
        // remove
        // console.dir(item);
        if (item[primary] === input.changeEvent.id) {
            results.splice(i, 1);
            break;
        }
    }
};

export const replaceExisting: ActionFunction<any> = (input) => {
    // find index of document
    const doc = input.changeEvent.doc;
    const primary = input.queryParams.primaryKey;
    const results = input.previousResults;
    for (let i = 0; i < results.length; i++) {
        const item = results[i];
        // replace
        if (item[primary] === input.changeEvent.id) {
            results[i] = doc;
            if (input.keyDocumentMap) {
                input.keyDocumentMap.set(
                    input.changeEvent.id,
                    doc
                );
            }
            break;
        }
    }
};

/**
 * this function always returns wrong results
 * it must be later optimised out
 * otherwise there is something broken
 */
export const alwaysWrong: ActionFunction<any> = (input) => {
    input.previousResults.length = 0; // clear array
    input.previousResults.push(STATIC_RANDOM_HUMAN);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.clear();
        input.keyDocumentMap.set(
            STATIC_RANDOM_HUMAN._id,
            STATIC_RANDOM_HUMAN
        );
    }
};

export const insertAtSortPosition: ActionFunction<any> = (input) => {
    const doc = input.changeEvent.doc;
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(
            input.changeEvent.id,
            doc
        );
    }
    pushAtSortPosition(
        input.previousResults,
        doc,
        input.queryParams.sortComparator,
        true
    );
};

export const removeExistingAndInsertAtSortPosition: ActionFunction<any> = (input) => {
    removeExisting(input);
    insertAtSortPosition(input);
};

export const runFullQueryAgain: ActionFunction<any> = (_input) => {
    throw new Error('Action runFullQueryAgain must be implemented by yourself');
};

export const unknownAction: ActionFunction<any> = (_input) => {
    throw new Error('Action unknownAction should never be called');
};
