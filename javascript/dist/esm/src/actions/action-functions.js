import { pushAtSortPosition } from 'array-push-at-sort-position';
export const doNothing = (_input) => { };
export const insertFirst = (input) => {
    input.previousResults.unshift(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, input.changeEvent.doc);
    }
};
export const insertLast = (input) => {
    input.previousResults.push(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, input.changeEvent.doc);
    }
};
export const removeFirstItem = (input) => {
    const first = input.previousResults.shift();
    if (input.keyDocumentMap && first) {
        input.keyDocumentMap.delete(first[input.queryParams.primaryKey]);
    }
};
export const removeLastItem = (input) => {
    const last = input.previousResults.pop();
    if (input.keyDocumentMap && last) {
        input.keyDocumentMap.delete(last[input.queryParams.primaryKey]);
    }
};
export const removeFirstInsertLast = (input) => {
    removeFirstItem(input);
    insertLast(input);
};
export const removeLastInsertFirst = (input) => {
    removeLastItem(input);
    insertFirst(input);
};
export const removeFirstInsertFirst = (input) => {
    removeFirstItem(input);
    insertFirst(input);
};
export const removeLastInsertLast = (input) => {
    removeLastItem(input);
    insertLast(input);
};
export const removeExisting = (input) => {
    if (input.keyDocumentMap) {
        input.keyDocumentMap.delete(input.changeEvent.id);
    }
    // find index of document
    const primary = input.queryParams.primaryKey;
    const results = input.previousResults;
    for (let i = 0; i < results.length; i++) {
        const item = results[i];
        // remove
        if (item[primary] === input.changeEvent.id) {
            results.splice(i, 1);
            break;
        }
    }
};
export const replaceExisting = (input) => {
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
                input.keyDocumentMap.set(input.changeEvent.id, doc);
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
export const alwaysWrong = (input) => {
    const wrongHuman = {
        _id: 'wrongHuman' + new Date().getTime()
    };
    input.previousResults.length = 0; // clear array
    input.previousResults.push(wrongHuman);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.clear();
        input.keyDocumentMap.set(wrongHuman._id, wrongHuman);
    }
};
export const insertAtSortPosition = (input) => {
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
        input.keyDocumentMap.set(docId, doc);
    }
    else {
        const isDocInResults = input.previousResults.find((d) => d[input.queryParams.primaryKey] === docId);
        /**
         * If document is already in results,
         * we cannot add it again because it would throw on non-deterministic ordering.
         */
        if (isDocInResults) {
            return;
        }
    }
    pushAtSortPosition(input.previousResults, doc, input.queryParams.sortComparator, 0);
};
export const removeExistingAndInsertAtSortPosition = (input) => {
    removeExisting(input);
    insertAtSortPosition(input);
};
export const runFullQueryAgain = (_input) => {
    throw new Error('Action runFullQueryAgain must be implemented by yourself');
};
export const unknownAction = (_input) => {
    throw new Error('Action unknownAction should never be called');
};
//# sourceMappingURL=action-functions.js.map