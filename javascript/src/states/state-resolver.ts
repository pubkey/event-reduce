import type { StateResolveFunction } from '../types/index.js';
import { getProperty } from '../util.js';

export const hasLimit: StateResolveFunction<any> = (input) => {
    return !!input.queryParams.limit;
};

export const isFindOne: StateResolveFunction<any> = (input) => {
    return input.queryParams.limit === 1;
};

export const hasSkip: StateResolveFunction<any> = (input) => {
    return !!input.queryParams.skip && input.queryParams.skip > 0;
};

export const isDelete: StateResolveFunction<any> = (input) => {
    return input.changeEvent.operation === 'DELETE';
};

export const isInsert: StateResolveFunction<any> = (input) => {
    return input.changeEvent.operation === 'INSERT';
};

export const isUpdate: StateResolveFunction<any> = (input) => {
    return input.changeEvent.operation === 'UPDATE';
};


export const wasLimitReached: StateResolveFunction<any> = (input) => {
    const limit = input.queryParams.limit;
    return !!limit && input.previousResults.length >= limit;
};

export const sortParamsChanged: StateResolveFunction<any> = (input) => {
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
        const beforeData = isNested ? getProperty(prev, field) : prev[field];
        const afterData = isNested ? getProperty(doc, field) : doc[field];
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};

export const wasInResult: StateResolveFunction<any> = (input) => {
    const id = input.changeEvent.id;
    if (input.keyDocumentMap) {
        return input.keyDocumentMap.has(id);
    } else {
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

export const wasFirst: StateResolveFunction<any> = (input) => {
    const first = input.previousResults[0];
    return !!first && first[input.queryParams.primaryKey] === input.changeEvent.id;
};

export const wasLast: StateResolveFunction<any> = (input) => {
    const results = input.previousResults;
    const last = results[results.length - 1];
    return !!last && last[input.queryParams.primaryKey] === input.changeEvent.id;
};


export const wasSortedBeforeFirst: StateResolveFunction<any> = (input) => {
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

export const wasSortedAfterLast: StateResolveFunction<any> = (input) => {
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

export const isSortedBeforeFirst: StateResolveFunction<any> = (input) => {
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

export const isSortedAfterLast: StateResolveFunction<any> = (input) => {
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


export const wasMatching: StateResolveFunction<any> = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev) {
        return false;
    }
    return input.queryParams.queryMatcher(prev);
};

export const doesMatchNow: StateResolveFunction<any> = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    return input.queryParams.queryMatcher(doc);
};


export const wasResultsEmpty: StateResolveFunction<any> = (input) => {
    return input.previousResults.length === 0;
};
