import objectPath from 'object-path';
import { lastOfArray, UNKNOWN_VALUE } from '../util';
export var hasLimit = function (input) {
    return !!input.queryParams.limit;
};
export var isFindOne = function (input) {
    return input.queryParams.limit === 1;
};
export var hasSkip = function (input) {
    if (input.queryParams.skip && input.queryParams.skip > 0) {
        return true;
    }
    else {
        return false;
    }
};
export var isDelete = function (input) {
    return input.changeEvent.operation === 'DELETE';
};
export var isInsert = function (input) {
    return input.changeEvent.operation === 'INSERT';
};
export var isUpdate = function (input) {
    return input.changeEvent.operation === 'UPDATE';
};
export var previousUnknown = function (input) {
    return input.changeEvent.previous === UNKNOWN_VALUE;
};
export var wasLimitReached = function (input) {
    return hasLimit(input) && input.previousResults.length >= input.queryParams.limit;
};
export var sortParamsChanged = function (input) {
    var sortFields = input.queryParams.sortFields;
    var prev = input.changeEvent.previous;
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    if (!prev || prev === UNKNOWN_VALUE) {
        return true;
    }
    for (var i = 0; i < sortFields.length; i++) {
        var field = sortFields[i];
        var beforeData = objectPath.get(prev, field);
        var afterData = objectPath.get(doc, field);
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};
export var wasInResult = function (input) {
    var id = input.changeEvent.id;
    if (input.keyDocumentMap) {
        var has = input.keyDocumentMap.has(id);
        return has;
    }
    else {
        var primary = input.queryParams.primaryKey;
        var results = input.previousResults;
        for (var i = 0; i < results.length; i++) {
            var item = results[i];
            if (item[primary] === id) {
                return true;
            }
        }
        return false;
    }
};
export var wasSortedBeforeFirst = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === UNKNOWN_VALUE) {
        return false;
    }
    var first = input.previousResults[0];
    if (!first) {
        return false;
    }
    var comp = input.queryParams.sortComparator(prev, first);
    return comp < 0;
};
export var wasSortedAfterLast = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === UNKNOWN_VALUE) {
        return false;
    }
    var last = lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }
    var comp = input.queryParams.sortComparator(prev, last);
    return comp > 0;
};
export var isSortedBeforeFirst = function (input) {
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    var first = input.previousResults[0];
    if (!first) {
        return false;
    }
    var comp = input.queryParams.sortComparator(doc, first);
    return comp < 0;
};
export var isSortedAfterLast = function (input) {
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    var last = lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }
    var comp = input.queryParams.sortComparator(doc, last);
    return comp > 0;
};
export var wasMatching = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === UNKNOWN_VALUE) {
        return false;
    }
    return input.queryParams.queryMatcher(prev);
};
export var doesMatchNow = function (input) {
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    var ret = input.queryParams.queryMatcher(doc);
    return ret;
};
export var wasResultsEmpty = function (input) {
    return input.previousResults.length === 0;
};
//# sourceMappingURL=state-resolver.js.map