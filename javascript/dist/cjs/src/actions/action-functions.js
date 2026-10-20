"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unknownAction = exports.runFullQueryAgain = exports.removeExistingAndInsertAtSortPosition = exports.insertAtSortPosition = exports.alwaysWrong = exports.replaceExisting = exports.removeExisting = exports.removeLastInsertLast = exports.removeFirstInsertFirst = exports.removeLastInsertFirst = exports.removeFirstInsertLast = exports.removeLastItem = exports.removeFirstItem = exports.insertLast = exports.insertFirst = exports.doNothing = void 0;
const array_push_at_sort_position_1 = require("array-push-at-sort-position");
const doNothing = (_input) => { };
exports.doNothing = doNothing;
const insertFirst = (input) => {
    input.previousResults.unshift(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, input.changeEvent.doc);
    }
};
exports.insertFirst = insertFirst;
const insertLast = (input) => {
    input.previousResults.push(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, input.changeEvent.doc);
    }
};
exports.insertLast = insertLast;
const removeFirstItem = (input) => {
    const first = input.previousResults.shift();
    if (input.keyDocumentMap && first) {
        input.keyDocumentMap.delete(first[input.queryParams.primaryKey]);
    }
};
exports.removeFirstItem = removeFirstItem;
const removeLastItem = (input) => {
    const last = input.previousResults.pop();
    if (input.keyDocumentMap && last) {
        input.keyDocumentMap.delete(last[input.queryParams.primaryKey]);
    }
};
exports.removeLastItem = removeLastItem;
const removeFirstInsertLast = (input) => {
    (0, exports.removeFirstItem)(input);
    (0, exports.insertLast)(input);
};
exports.removeFirstInsertLast = removeFirstInsertLast;
const removeLastInsertFirst = (input) => {
    (0, exports.removeLastItem)(input);
    (0, exports.insertFirst)(input);
};
exports.removeLastInsertFirst = removeLastInsertFirst;
const removeFirstInsertFirst = (input) => {
    (0, exports.removeFirstItem)(input);
    (0, exports.insertFirst)(input);
};
exports.removeFirstInsertFirst = removeFirstInsertFirst;
const removeLastInsertLast = (input) => {
    (0, exports.removeLastItem)(input);
    (0, exports.insertLast)(input);
};
exports.removeLastInsertLast = removeLastInsertLast;
const removeExisting = (input) => {
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
exports.removeExisting = removeExisting;
const replaceExisting = (input) => {
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
exports.replaceExisting = replaceExisting;
/**
 * this function always returns wrong results
 * it must be later optimised out
 * otherwise there is something broken
 */
const alwaysWrong = (input) => {
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
exports.alwaysWrong = alwaysWrong;
const insertAtSortPosition = (input) => {
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
    (0, array_push_at_sort_position_1.pushAtSortPosition)(input.previousResults, doc, input.queryParams.sortComparator, 0);
};
exports.insertAtSortPosition = insertAtSortPosition;
const removeExistingAndInsertAtSortPosition = (input) => {
    (0, exports.removeExisting)(input);
    (0, exports.insertAtSortPosition)(input);
};
exports.removeExistingAndInsertAtSortPosition = removeExistingAndInsertAtSortPosition;
const runFullQueryAgain = (_input) => {
    throw new Error('Action runFullQueryAgain must be implemented by yourself');
};
exports.runFullQueryAgain = runFullQueryAgain;
const unknownAction = (_input) => {
    throw new Error('Action unknownAction should never be called');
};
exports.unknownAction = unknownAction;
//# sourceMappingURL=action-functions.js.map