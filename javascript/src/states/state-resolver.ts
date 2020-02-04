import objectPath from 'object-path';
import { StateResolveFunction } from '../types';
import { lastOfArray } from '../util';
import { UNKNOWN_VALUE } from '../logic-generator/config';

export const hasLimit: StateResolveFunction<any> = (input) => {
    return !!input.queryParams.limit;
};

export const isFindOne: StateResolveFunction<any> = (input) => {
    return input.queryParams.limit === 1;
};

export const hasSkip: StateResolveFunction<any> = (input) => {
    if (input.queryParams.skip && input.queryParams.skip > 0) {
        return true;
    } else {
        return false;
    }
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

export const previousUnknown: StateResolveFunction<any> = (input) => {
    return input.changeEvent.previous === UNKNOWN_VALUE;
};

export const wasLimitReached: StateResolveFunction<any> = (input) => {
    return hasLimit(input) && input.previousResults.length >= (input.queryParams.limit as number);
};

export const sortParamsChanged: StateResolveFunction<any> = (input) => {
    const sortFields = input.queryParams.sortFields;
    const prev = input.changeEvent.previous;
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    if (!prev || prev === UNKNOWN_VALUE) {
        return true;
    }

    for (let i = 0; i < sortFields.length; i++) {
        const field = sortFields[i];
        const beforeData = objectPath.get(prev, field);
        const afterData = objectPath.get(doc, field);
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};

export const wasInResult: StateResolveFunction<any> = (input) => {
    const id = input.changeEvent.id;
    if (input.keyDocumentMap) {
        const has = input.keyDocumentMap.has(id);
        return has;
    } else {
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

export const wasSortedBeforeFirst: StateResolveFunction<any> = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev || prev === UNKNOWN_VALUE) {
        return false;
    }

    const first = input.previousResults[0];
    if (!first) {
        return false;
    }

    const comp = input.queryParams.sortComparator(
        prev,
        first
    );
    return comp < 0;
};

export const wasSortedAfterLast: StateResolveFunction<any> = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev || prev === UNKNOWN_VALUE) {
        return false;
    }

    const last = lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }

    const comp = input.queryParams.sortComparator(
        prev,
        last
    );
    return comp > 0;
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

    const comp = input.queryParams.sortComparator(
        doc,
        first
    );
    return comp < 0;
};

export const isSortedAfterLast: StateResolveFunction<any> = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }

    const last = lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }

    const comp = input.queryParams.sortComparator(
        doc,
        last
    );
    return comp > 0;
};


export const wasMatching: StateResolveFunction<any> = (input) => {
    const prev = input.changeEvent.previous;
    if (!prev || prev === UNKNOWN_VALUE) {
        return false;
    }
    return input.queryParams.queryMatcher(
        prev
    );
};

export const doesMatchNow: StateResolveFunction<any> = (input) => {
    const doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    return input.queryParams.queryMatcher(
        doc
    );
};


export const wasResultsEmpty: StateResolveFunction<any> = (input) => {
    return input.previousResults.length === 0;
};

/**
 * the last state-function
 * always returns true.
 * This should be optimised out by later steps
 * when we remove invalid states
 */
export const alwaysTrue: StateResolveFunction<any> = (_input) => {
    return true;
};
