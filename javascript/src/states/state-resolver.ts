import type { InternalFunction, StateResolveFunction } from '../types/index.js';
import { getProperty, toPublicFunction } from '../util.js';

/**
 * The state functions are implemented on the positional InternalInput
 * so that minifiers can rename the input variables
 * and the long property names do not end up in the bundle.
 */
type InternalStateFunction = InternalFunction<any, boolean>;

const hasLimitInternal: InternalStateFunction = ([queryParams]) => !!queryParams.limit;

const isFindOneInternal: InternalStateFunction = ([queryParams]) => queryParams.limit === 1;

const hasSkipInternal: InternalStateFunction = ([queryParams]) => !!queryParams.skip && queryParams.skip > 0;

const isDeleteInternal: InternalStateFunction = ([, changeEvent]) => changeEvent.operation === 'DELETE';

const isInsertInternal: InternalStateFunction = ([, changeEvent]) => changeEvent.operation === 'INSERT';

const isUpdateInternal: InternalStateFunction = ([, changeEvent]) => changeEvent.operation === 'UPDATE';


const wasLimitReachedInternal: InternalStateFunction = ([queryParams, , previousResults]) => {
    const limit = queryParams.limit;
    return !!limit && previousResults.length >= limit;
};

const sortParamsChangedInternal: InternalStateFunction = ([queryParams, changeEvent]) => {
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

const wasInResultInternal: InternalStateFunction = ([queryParams, changeEvent, previousResults, keyDocumentMap]) => {
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

const wasFirstInternal: InternalStateFunction = ([queryParams, changeEvent, previousResults]) => {
    const first = previousResults[0];
    return !!first && first[queryParams.primaryKey] === changeEvent.id;
};

const wasLastInternal: InternalStateFunction = ([queryParams, changeEvent, previousResults]) => {
    const last = previousResults[previousResults.length - 1];
    return !!last && last[queryParams.primaryKey] === changeEvent.id;
};


const wasSortedBeforeFirstInternal: InternalStateFunction = ([queryParams, changeEvent, previousResults]) => {
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

const wasSortedAfterLastInternal: InternalStateFunction = ([queryParams, changeEvent, previousResults]) => {
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

const isSortedBeforeFirstInternal: InternalStateFunction = ([queryParams, changeEvent, previousResults]) => {
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

const isSortedAfterLastInternal: InternalStateFunction = ([queryParams, changeEvent, previousResults]) => {
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


const wasMatchingInternal: InternalStateFunction = ([queryParams, changeEvent]) => {
    const prev = changeEvent.previous;
    if (!prev) {
        return false;
    }
    return queryParams.queryMatcher(prev);
};

const doesMatchNowInternal: InternalStateFunction = ([queryParams, changeEvent]) => {
    const doc = changeEvent.doc;
    if (!doc) {
        return false;
    }
    return queryParams.queryMatcher(doc);
};


const wasResultsEmptyInternal: InternalStateFunction = ([, , previousResults]) => previousResults.length === 0;

/**
 * The internal state functions in the same order as orderedStateList.
 * The BDD resolves with these.
 */
export const internalStateResolvers: InternalStateFunction[] = [
    isInsertInternal,
    isUpdateInternal,
    isDeleteInternal,
    hasLimitInternal,
    isFindOneInternal,
    hasSkipInternal,
    wasResultsEmptyInternal,
    wasLimitReachedInternal,
    wasFirstInternal,
    wasLastInternal,
    sortParamsChangedInternal,
    wasInResultInternal,
    wasSortedBeforeFirstInternal,
    wasSortedAfterLastInternal,
    isSortedBeforeFirstInternal,
    isSortedAfterLastInternal,
    wasMatchingInternal,
    doesMatchNowInternal
];

export const hasLimit: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(hasLimitInternal);
export const isFindOne: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(isFindOneInternal);
export const hasSkip: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(hasSkipInternal);
export const isDelete: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(isDeleteInternal);
export const isInsert: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(isInsertInternal);
export const isUpdate: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(isUpdateInternal);
export const wasLimitReached: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(wasLimitReachedInternal);
export const sortParamsChanged: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(sortParamsChangedInternal);
export const wasInResult: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(wasInResultInternal);
export const wasFirst: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(wasFirstInternal);
export const wasLast: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(wasLastInternal);
export const wasSortedBeforeFirst: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(wasSortedBeforeFirstInternal);
export const wasSortedAfterLast: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(wasSortedAfterLastInternal);
export const isSortedBeforeFirst: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(isSortedBeforeFirstInternal);
export const isSortedAfterLast: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(isSortedAfterLastInternal);
export const wasMatching: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(wasMatchingInternal);
export const doesMatchNow: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(doesMatchNowInternal);
export const wasResultsEmpty: StateResolveFunction<any> = /* @__PURE__ */ toPublicFunction(wasResultsEmptyInternal);
