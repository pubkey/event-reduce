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
 *
 * The input properties are destructured once at the top of each function
 * so that minifiers can rename the local variables and the long
 * property names only appear once per function in the bundle.
 */
function findIndexOfChangedDoc({ queryParams, changeEvent, previousResults, keyDocumentMap }) {
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
const doNothing = (_input) => { };
exports.doNothing = doNothing;
const insertFirst = ({ changeEvent, previousResults, keyDocumentMap }) => {
    previousResults.unshift(changeEvent.doc);
    if (keyDocumentMap) {
        keyDocumentMap.set(changeEvent.id, changeEvent.doc);
    }
};
exports.insertFirst = insertFirst;
const insertLast = ({ changeEvent, previousResults, keyDocumentMap }) => {
    previousResults.push(changeEvent.doc);
    if (keyDocumentMap) {
        keyDocumentMap.set(changeEvent.id, changeEvent.doc);
    }
};
exports.insertLast = insertLast;
const removeFirstItem = ({ queryParams, previousResults, keyDocumentMap }) => {
    const first = previousResults.shift();
    if (keyDocumentMap && first) {
        keyDocumentMap.delete(first[queryParams.primaryKey]);
    }
};
exports.removeFirstItem = removeFirstItem;
const removeLastItem = ({ queryParams, previousResults, keyDocumentMap }) => {
    const last = previousResults.pop();
    if (keyDocumentMap && last) {
        keyDocumentMap.delete(last[queryParams.primaryKey]);
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
    const { changeEvent, previousResults, keyDocumentMap } = input;
    const index = findIndexOfChangedDoc(input);
    if (keyDocumentMap) {
        keyDocumentMap.delete(changeEvent.id);
    }
    if (index >= 0) {
        previousResults.splice(index, 1);
    }
};
exports.removeExisting = removeExisting;
const replaceExisting = (input) => {
    const { changeEvent, previousResults, keyDocumentMap } = input;
    const index = findIndexOfChangedDoc(input);
    if (index >= 0) {
        const doc = changeEvent.doc;
        previousResults[index] = doc;
        if (keyDocumentMap) {
            keyDocumentMap.set(changeEvent.id, doc);
        }
    }
};
exports.replaceExisting = replaceExisting;
/**
 * this function always returns wrong results
 * it must be later optimised out
 * otherwise there is something broken
 */
const alwaysWrong = ({ previousResults, keyDocumentMap }) => {
    const wrongHuman = {
        _id: 'wrongHuman' + new Date().getTime()
    };
    previousResults.length = 0; // clear array
    previousResults.push(wrongHuman);
    if (keyDocumentMap) {
        keyDocumentMap.clear();
        keyDocumentMap.set(wrongHuman._id, wrongHuman);
    }
};
exports.alwaysWrong = alwaysWrong;
const insertAtSortPosition = ({ queryParams, changeEvent, previousResults, keyDocumentMap }) => {
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
        keyDocumentMap.set(docId, doc);
    }
    else {
        const primaryKey = queryParams.primaryKey;
        const isDocInResults = previousResults.find((d) => d[primaryKey] === docId);
        /**
         * If document is already in results,
         * we cannot add it again because it would throw on non-deterministic ordering.
         */
        if (isDocInResults) {
            return;
        }
    }
    (0, array_push_at_sort_position_1.pushAtSortPosition)(previousResults, doc, queryParams.sortComparator, 0);
};
exports.insertAtSortPosition = insertAtSortPosition;
const removeExistingAndInsertAtSortPosition = (input) => {
    (0, exports.removeExisting)(input);
    (0, exports.insertAtSortPosition)(input);
};
exports.removeExistingAndInsertAtSortPosition = removeExistingAndInsertAtSortPosition;
const runFullQueryAgain = (_input) => {
    throw new Error('EventReduce:RUN_FULL');
};
exports.runFullQueryAgain = runFullQueryAgain;
const unknownAction = (_input) => {
    throw new Error('EventReduce:UNK_ACT');
};
exports.unknownAction = unknownAction;
//# sourceMappingURL=action-functions.js.map