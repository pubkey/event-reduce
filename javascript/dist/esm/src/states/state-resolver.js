import { getProperty } from '../util.js';
/**
 * The input properties are destructured once at the top of each function
 * so that minifiers can rename the local variables and the long
 * property names only appear once per function in the bundle.
 */
export const hasLimit = ({ queryParams }) => !!queryParams.limit;
export const isFindOne = ({ queryParams }) => queryParams.limit === 1;
export const hasSkip = ({ queryParams }) => !!queryParams.skip && queryParams.skip > 0;
export const isDelete = ({ changeEvent }) => changeEvent.operation === 'DELETE';
export const isInsert = ({ changeEvent }) => changeEvent.operation === 'INSERT';
export const isUpdate = ({ changeEvent }) => changeEvent.operation === 'UPDATE';
export const wasLimitReached = ({ queryParams, previousResults }) => {
    const limit = queryParams.limit;
    return !!limit && previousResults.length >= limit;
};
export const sortParamsChanged = ({ queryParams, changeEvent }) => {
    const sortFields = queryParams.sortFields;
    const prev = changeEvent.previous;
    const doc = changeEvent.doc;
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
        const beforeData = isNested ? getProperty(prev, field) : prev[field];
        const afterData = isNested ? getProperty(doc, field) : doc[field];
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};
export const wasInResult = ({ queryParams, changeEvent, previousResults, keyDocumentMap }) => {
    const id = changeEvent.id;
    if (keyDocumentMap) {
        return keyDocumentMap.has(id);
    }
    else {
        const primary = queryParams.primaryKey;
        for (let i = 0; i < previousResults.length; i++) {
            if (previousResults[i][primary] === id) {
                return true;
            }
        }
        return false;
    }
};
export const wasFirst = ({ queryParams, changeEvent, previousResults }) => {
    const first = previousResults[0];
    return !!first && first[queryParams.primaryKey] === changeEvent.id;
};
export const wasLast = ({ queryParams, changeEvent, previousResults }) => {
    const last = previousResults[previousResults.length - 1];
    return !!last && last[queryParams.primaryKey] === changeEvent.id;
};
export const wasSortedBeforeFirst = ({ queryParams, changeEvent, previousResults }) => {
    const prev = changeEvent.previous;
    if (!prev) {
        return false;
    }
    const first = previousResults[0];
    if (!first) {
        return false;
    }
    /**
     * If the changed document is the same as the first,
     * we cannot sort-compare them, because it might end in a non-deterministic
     * sort order. Because both document could be equal.
     * So instead we have to return true.
     */
    if (first[queryParams.primaryKey] === changeEvent.id) {
        return true;
    }
    return queryParams.sortComparator(prev, first) < 0;
};
export const wasSortedAfterLast = ({ queryParams, changeEvent, previousResults }) => {
    const prev = changeEvent.previous;
    if (!prev) {
        return false;
    }
    const last = previousResults[previousResults.length - 1];
    if (!last) {
        return false;
    }
    if (last[queryParams.primaryKey] === changeEvent.id) {
        return true;
    }
    return queryParams.sortComparator(prev, last) > 0;
};
export const isSortedBeforeFirst = ({ queryParams, changeEvent, previousResults }) => {
    const doc = changeEvent.doc;
    if (!doc) {
        return false;
    }
    const first = previousResults[0];
    if (!first) {
        return false;
    }
    if (first[queryParams.primaryKey] === changeEvent.id) {
        return true;
    }
    return queryParams.sortComparator(doc, first) < 0;
};
export const isSortedAfterLast = ({ queryParams, changeEvent, previousResults }) => {
    const doc = changeEvent.doc;
    if (!doc) {
        return false;
    }
    const last = previousResults[previousResults.length - 1];
    if (!last) {
        return false;
    }
    if (last[queryParams.primaryKey] === changeEvent.id) {
        return true;
    }
    return queryParams.sortComparator(doc, last) > 0;
};
export const wasMatching = ({ queryParams, changeEvent }) => {
    const prev = changeEvent.previous;
    if (!prev) {
        return false;
    }
    return queryParams.queryMatcher(prev);
};
export const doesMatchNow = ({ queryParams, changeEvent }) => {
    const doc = changeEvent.doc;
    if (!doc) {
        return false;
    }
    return queryParams.queryMatcher(doc);
};
export const wasResultsEmpty = ({ previousResults }) => previousResults.length === 0;
//# sourceMappingURL=state-resolver.js.map