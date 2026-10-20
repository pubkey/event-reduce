import type { StateResolveFunction } from '../types/index.js';
import { getProperty } from '../util.js';

/**
 * The input properties are destructured once at the top of each function
 * so that minifiers can rename the local variables and the long
 * property names only appear once per function in the bundle.
 */

export const hasLimit: StateResolveFunction<any> = ({ queryParams }) => !!queryParams.limit;

export const isFindOne: StateResolveFunction<any> = ({ queryParams }) => queryParams.limit === 1;

export const hasSkip: StateResolveFunction<any> = ({ queryParams }) => !!queryParams.skip && queryParams.skip > 0;

export const isDelete: StateResolveFunction<any> = ({ changeEvent }) => changeEvent.operation === 'DELETE';

export const isInsert: StateResolveFunction<any> = ({ changeEvent }) => changeEvent.operation === 'INSERT';

export const isUpdate: StateResolveFunction<any> = ({ changeEvent }) => changeEvent.operation === 'UPDATE';


export const wasLimitReached: StateResolveFunction<any> = ({ queryParams, previousResults }) => {
    const limit = queryParams.limit;
    return !!limit && previousResults.length >= limit;
};

export const sortParamsChanged: StateResolveFunction<any> = ({ queryParams, changeEvent }) => {
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

export const wasInResult: StateResolveFunction<any> = ({ queryParams, changeEvent, previousResults, keyDocumentMap }) => {
    const id = changeEvent.id;
    if (keyDocumentMap) {
        return keyDocumentMap.has(id);
    } else {
        const primary = queryParams.primaryKey;
        for (let i = 0; i < previousResults.length; i++) {
            if (previousResults[i][primary] === id) {
                return true;
            }
        }
        return false;
    }
};

export const wasFirst: StateResolveFunction<any> = ({ queryParams, changeEvent, previousResults }) => {
    const first = previousResults[0];
    return !!first && first[queryParams.primaryKey] === changeEvent.id;
};

export const wasLast: StateResolveFunction<any> = ({ queryParams, changeEvent, previousResults }) => {
    const last = previousResults[previousResults.length - 1];
    return !!last && last[queryParams.primaryKey] === changeEvent.id;
};


export const wasSortedBeforeFirst: StateResolveFunction<any> = ({ queryParams, changeEvent, previousResults }) => {
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

export const wasSortedAfterLast: StateResolveFunction<any> = ({ queryParams, changeEvent, previousResults }) => {
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

export const isSortedBeforeFirst: StateResolveFunction<any> = ({ queryParams, changeEvent, previousResults }) => {
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

export const isSortedAfterLast: StateResolveFunction<any> = ({ queryParams, changeEvent, previousResults }) => {
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


export const wasMatching: StateResolveFunction<any> = ({ queryParams, changeEvent }) => {
    const prev = changeEvent.previous;
    if (!prev) {
        return false;
    }
    return queryParams.queryMatcher(prev);
};

export const doesMatchNow: StateResolveFunction<any> = ({ queryParams, changeEvent }) => {
    const doc = changeEvent.doc;
    if (!doc) {
        return false;
    }
    return queryParams.queryMatcher(doc);
};


export const wasResultsEmpty: StateResolveFunction<any> = ({ previousResults }) => previousResults.length === 0;
