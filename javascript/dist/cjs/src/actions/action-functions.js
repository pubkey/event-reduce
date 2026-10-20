"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unknownAction = exports.runFullQueryAgain = exports.removeExistingAndInsertAtSortPosition = exports.insertAtSortPosition = exports.alwaysWrong = exports.replaceExisting = exports.removeExisting = exports.removeLastInsertLast = exports.removeFirstInsertFirst = exports.removeLastInsertFirst = exports.removeFirstInsertLast = exports.removeLastItem = exports.removeFirstItem = exports.insertLast = exports.insertFirst = exports.doNothing = void 0;
const array_push_at_sort_position_1 = require("array-push-at-sort-position");
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
function findIndexOfChangedDoc(input) {
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
    const index = findIndexOfChangedDoc(input);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.delete(input.changeEvent.id);
    }
    if (index >= 0) {
        input.previousResults.splice(index, 1);
    }
};
exports.removeExisting = removeExisting;
const replaceExisting = (input) => {
    const index = findIndexOfChangedDoc(input);
    if (index >= 0) {
        const doc = input.changeEvent.doc;
        input.previousResults[index] = doc;
        if (input.keyDocumentMap) {
            input.keyDocumentMap.set(input.changeEvent.id, doc);
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