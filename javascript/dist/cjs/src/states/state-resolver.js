"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wasResultsEmpty = exports.doesMatchNow = exports.wasMatching = exports.isSortedAfterLast = exports.isSortedBeforeFirst = exports.wasSortedAfterLast = exports.wasSortedBeforeFirst = exports.wasLast = exports.wasFirst = exports.wasInResult = exports.sortParamsChanged = exports.wasLimitReached = exports.isUpdate = exports.isInsert = exports.isDelete = exports.hasSkip = exports.isFindOne = exports.hasLimit = void 0;
const util_js_1 = require("../util.js");
const hasLimit = (input) => {
    return !!input.queryParams.limit;
};
exports.hasLimit = hasLimit;
const isFindOne = (input) => {
    return input.queryParams.limit === 1;
};
exports.isFindOne = isFindOne;
const hasSkip = (input) => {
    if (input.queryParams.skip && input.queryParams.skip > 0) {
        return true;
    }
    else {
        return false;
    }
};
exports.hasSkip = hasSkip;
const isDelete = (input) => {
    return input.changeEvent.operation === 'DELETE';
};
exports.isDelete = isDelete;
const isInsert = (input) => {
    return input.changeEvent.operation === 'INSERT';
};
exports.isInsert = isInsert;
const isUpdate = (input) => {
    return input.changeEvent.operation === 'UPDATE';
};
exports.isUpdate = isUpdate;
const wasLimitReached = (input) => {
    return (0, exports.hasLimit)(input) && input.previousResults.length >= input.queryParams.limit;
};
exports.wasLimitReached = wasLimitReached;
const sortParamsChanged = (input) => {
    const sortFields = input.queryParams.sortFields;
    const prev = input.changeEvent.previous;
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    if (!prev) {
        return true;
    }
    for (let i = 0; i < sortFields.length; i++) {
        const field = sortFields[i];
        const beforeData = (0, util_js_1.getProperty)(prev, field);
        const afterData = (0, util_js_1.getProperty)(doc, field);
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};
exports.sortParamsChanged = sortParamsChanged;
const wasInResult = (input) => {
    const id = input.changeEvent.id;
    if (input.keyDocumentMap) {
        const has = input.keyDocumentMap.has(id);
        return has;
    }
    else {
        const primary = input.queryParams.primaryKey;
        const results = input.previousResults;
        for (let i = 0; i < results.length; i++) {
            const item = results[i];
            if (item[primary] === id) {
                return true;
            }
        }
        return false;
    }
};
exports.wasInResult = wasInResult;
const wasFirst = (input) => {
    const first = input.previousResults[0];
    if (first && first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    else {
        return false;
    }
};
exports.wasFirst = wasFirst;
const wasLast = (input) => {
    const last = (0, util_js_1.lastOfArray)(input.previousResults);
    if (last && last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    else {
        return false;
    }
};
exports.wasLast = wasLast;
const wasSortedBeforeFirst = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    const first = input.previousResults[0];
    if (!first) {
        return false;
    }
    /**
     * If the changed document is the same as the first,
     * we cannot sort-compare them, because it might end in a non-deterministic
     * sort order. Because both document could be equal.
     * So instead we have to return true.
     */
    if (first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(prev, first);
    return comp < 0;
};
exports.wasSortedBeforeFirst = wasSortedBeforeFirst;
const wasSortedAfterLast = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    const last = (0, util_js_1.lastOfArray)(input.previousResults);
    if (!last) {
        return false;
    }
    if (last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(prev, last);
    return comp > 0;
};
exports.wasSortedAfterLast = wasSortedAfterLast;
const isSortedBeforeFirst = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const first = input.previousResults[0];
    if (!first) {
        return false;
    }
    if (first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(doc, first);
    return comp < 0;
};
exports.isSortedBeforeFirst = isSortedBeforeFirst;
const isSortedAfterLast = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const last = (0, util_js_1.lastOfArray)(input.previousResults);
    if (!last) {
        return false;
    }
    if (last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(doc, last);
    return comp > 0;
};
exports.isSortedAfterLast = isSortedAfterLast;
const wasMatching = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    return input.queryParams.queryMatcher(prev);
};
exports.wasMatching = wasMatching;
const doesMatchNow = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const ret = input.queryParams.queryMatcher(doc);
    return ret;
};
exports.doesMatchNow = doesMatchNow;
const wasResultsEmpty = (input) => {
    return input.previousResults.length === 0;
};
exports.wasResultsEmpty = wasResultsEmpty;
//# sourceMappingURL=state-resolver.js.map