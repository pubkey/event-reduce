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
    return !!input.queryParams.skip && input.queryParams.skip > 0;
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
    const limit = input.queryParams.limit;
    return !!limit && input.previousResults.length >= limit;
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
        // Use direct property access for simple fields (no nested path).
        // Falls back to getProperty() for dot-separated nested paths.
        const isNested = field.includes('.');
        const beforeData = isNested ? (0, util_js_1.getProperty)(prev, field) : prev[field];
        const afterData = isNested ? (0, util_js_1.getProperty)(doc, field) : doc[field];
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
        return input.keyDocumentMap.has(id);
    }
    else {
        const primary = input.queryParams.primaryKey;
        const results = input.previousResults;
        for (let i = 0; i < results.length; i++) {
            if (results[i][primary] === id) {
                return true;
            }
        }
        return false;
    }
};
exports.wasInResult = wasInResult;
const wasFirst = (input) => {
    const first = input.previousResults[0];
    return !!first && first[input.queryParams.primaryKey] === input.changeEvent.id;
};
exports.wasFirst = wasFirst;
const wasLast = (input) => {
    const results = input.previousResults;
    const last = results[results.length - 1];
    return !!last && last[input.queryParams.primaryKey] === input.changeEvent.id;
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
    const primaryKey = input.queryParams.primaryKey;
    if (first[primaryKey] === input.changeEvent.id) {
        return true;
    }
    return input.queryParams.sortComparator(prev, first) < 0;
};
exports.wasSortedBeforeFirst = wasSortedBeforeFirst;
const wasSortedAfterLast = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    const results = input.previousResults;
    const last = results[results.length - 1];
    if (!last) {
        return false;
    }
    const primaryKey = input.queryParams.primaryKey;
    if (last[primaryKey] === input.changeEvent.id) {
        return true;
    }
    return input.queryParams.sortComparator(prev, last) > 0;
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
    const primaryKey = input.queryParams.primaryKey;
    if (first[primaryKey] === input.changeEvent.id) {
        return true;
    }
    return input.queryParams.sortComparator(doc, first) < 0;
};
exports.isSortedBeforeFirst = isSortedBeforeFirst;
const isSortedAfterLast = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const results = input.previousResults;
    const last = results[results.length - 1];
    if (!last) {
        return false;
    }
    const primaryKey = input.queryParams.primaryKey;
    if (last[primaryKey] === input.changeEvent.id) {
        return true;
    }
    return input.queryParams.sortComparator(doc, last) > 0;
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
    return input.queryParams.queryMatcher(doc);
};
exports.doesMatchNow = doesMatchNow;
const wasResultsEmpty = (input) => {
    return input.previousResults.length === 0;
};
exports.wasResultsEmpty = wasResultsEmpty;
//# sourceMappingURL=state-resolver.js.map