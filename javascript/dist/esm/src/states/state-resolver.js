import { getProperty } from '../util.js';
export const hasLimit = (input) => {
    return !!input.queryParams.limit;
};
export const isFindOne = (input) => {
    return input.queryParams.limit === 1;
};
export const hasSkip = (input) => {
    return !!input.queryParams.skip && input.queryParams.skip > 0;
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
    const limit = input.queryParams.limit;
    return !!limit && input.previousResults.length >= limit;
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
        const beforeData = field.includes('.') ? getProperty(prev, field) : prev[field];
        const afterData = field.includes('.') ? getProperty(doc, field) : doc[field];
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};
export const wasInResult = (input) => {
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
export const wasFirst = (input) => {
    const first = input.previousResults[0];
    return !!first && first[input.queryParams.primaryKey] === input.changeEvent.id;
};
export const wasLast = (input) => {
    const results = input.previousResults;
    const last = results[results.length - 1];
    return !!last && last[input.queryParams.primaryKey] === input.changeEvent.id;
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
    const primaryKey = input.queryParams.primaryKey;
    if (first[primaryKey] === input.changeEvent.id) {
        return true;
    }
    return input.queryParams.sortComparator(prev, first) < 0;
};
export const wasSortedAfterLast = (input) => {
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
export const isSortedBeforeFirst = (input) => {
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
export const isSortedAfterLast = (input) => {
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
    return input.queryParams.queryMatcher(doc);
};
export const wasResultsEmpty = (input) => {
    return input.previousResults.length === 0;
};
//# sourceMappingURL=state-resolver.js.map