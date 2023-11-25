import { getProperty, lastOfArray } from '../util.js';
export const hasLimit = (input) => {
    return !!input.queryParams.limit;
};
export const isFindOne = (input) => {
    return input.queryParams.limit === 1;
};
export const hasSkip = (input) => {
    if (input.queryParams.skip && input.queryParams.skip > 0) {
        return true;
    }
    else {
        return false;
    }
};
export const isDelete = (input) => {
    return input.changeEvent.operation === 'DELETE';
};
export const isInsert = (input) => {
    return input.changeEvent.operation === 'INSERT';
};
export const isUpdate = (input) => {
    return input.changeEvent.operation === 'UPDATE';
};
export const wasLimitReached = (input) => {
    return hasLimit(input) && input.previousResults.length >= input.queryParams.limit;
};
export const sortParamsChanged = (input) => {
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
        const beforeData = getProperty(prev, field);
        const afterData = getProperty(doc, field);
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};
export const wasInResult = (input) => {
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
export const wasFirst = (input) => {
    const first = input.previousResults[0];
    if (first && first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    else {
        return false;
    }
};
export const wasLast = (input) => {
    const last = lastOfArray(input.previousResults);
    if (last && last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    else {
        return false;
    }
};
export const wasSortedBeforeFirst = (input) => {
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
export const wasSortedAfterLast = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    const last = lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }
    if (last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(prev, last);
    return comp > 0;
};
export const isSortedBeforeFirst = (input) => {
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
export const isSortedAfterLast = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const last = lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }
    if (last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    const comp = input.queryParams.sortComparator(doc, last);
    return comp > 0;
};
export const wasMatching = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    return input.queryParams.queryMatcher(prev);
};
export const doesMatchNow = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    const ret = input.queryParams.queryMatcher(doc);
    return ret;
};
export const wasResultsEmpty = (input) => {
    return input.previousResults.length === 0;
};
//# sourceMappingURL=state-resolver.js.map