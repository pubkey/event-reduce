"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wasResultsEmpty = exports.doesMatchNow = exports.wasMatching = exports.isSortedAfterLast = exports.isSortedBeforeFirst = exports.wasSortedAfterLast = exports.wasSortedBeforeFirst = exports.wasLast = exports.wasFirst = exports.wasInResult = exports.sortParamsChanged = exports.wasLimitReached = exports.previousUnknown = exports.isUpdate = exports.isInsert = exports.isDelete = exports.hasSkip = exports.isFindOne = exports.hasLimit = void 0;
var util_1 = require("../util");
var hasLimit = function (input) {
    return !!input.queryParams.limit;
};
exports.hasLimit = hasLimit;
var isFindOne = function (input) {
    return input.queryParams.limit === 1;
};
exports.isFindOne = isFindOne;
var hasSkip = function (input) {
    if (input.queryParams.skip && input.queryParams.skip > 0) {
        return true;
    }
    else {
        return false;
    }
};
exports.hasSkip = hasSkip;
var isDelete = function (input) {
    return input.changeEvent.operation === 'DELETE';
};
exports.isDelete = isDelete;
var isInsert = function (input) {
    return input.changeEvent.operation === 'INSERT';
};
exports.isInsert = isInsert;
var isUpdate = function (input) {
    return input.changeEvent.operation === 'UPDATE';
};
exports.isUpdate = isUpdate;
var previousUnknown = function (input) {
    return input.changeEvent.previous === util_1.UNKNOWN_VALUE;
};
exports.previousUnknown = previousUnknown;
var wasLimitReached = function (input) {
    return (0, exports.hasLimit)(input) && input.previousResults.length >= input.queryParams.limit;
};
exports.wasLimitReached = wasLimitReached;
var sortParamsChanged = function (input) {
    var sortFields = input.queryParams.sortFields;
    var prev = input.changeEvent.previous;
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    if (!prev || prev === util_1.UNKNOWN_VALUE) {
        return true;
    }
    for (var i = 0; i < sortFields.length; i++) {
        var field = sortFields[i];
        var beforeData = (0, util_1.getProperty)(prev, field);
        var afterData = (0, util_1.getProperty)(doc, field);
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};
exports.sortParamsChanged = sortParamsChanged;
var wasInResult = function (input) {
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
exports.wasInResult = wasInResult;
var wasFirst = function (input) {
    var first = input.previousResults[0];
    if (first && first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    else {
        return false;
    }
};
exports.wasFirst = wasFirst;
var wasLast = function (input) {
    var last = (0, util_1.lastOfArray)(input.previousResults);
    if (last && last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    else {
        return false;
    }
};
exports.wasLast = wasLast;
var wasSortedBeforeFirst = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === util_1.UNKNOWN_VALUE) {
        return false;
    }
    var first = input.previousResults[0];
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
    var comp = input.queryParams.sortComparator(prev, first);
    return comp < 0;
};
exports.wasSortedBeforeFirst = wasSortedBeforeFirst;
var wasSortedAfterLast = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === util_1.UNKNOWN_VALUE) {
        return false;
    }
    var last = (0, util_1.lastOfArray)(input.previousResults);
    if (!last) {
        return false;
    }
    if (last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    var comp = input.queryParams.sortComparator(prev, last);
    return comp > 0;
};
exports.wasSortedAfterLast = wasSortedAfterLast;
var isSortedBeforeFirst = function (input) {
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    var first = input.previousResults[0];
    if (!first) {
        return false;
    }
    if (first[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    var comp = input.queryParams.sortComparator(doc, first);
    return comp < 0;
};
exports.isSortedBeforeFirst = isSortedBeforeFirst;
var isSortedAfterLast = function (input) {
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    var last = (0, util_1.lastOfArray)(input.previousResults);
    if (!last) {
        return false;
    }
    if (last[input.queryParams.primaryKey] === input.changeEvent.id) {
        return true;
    }
    var comp = input.queryParams.sortComparator(doc, last);
    return comp > 0;
};
exports.isSortedAfterLast = isSortedAfterLast;
var wasMatching = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === util_1.UNKNOWN_VALUE) {
        return false;
    }
    return input.queryParams.queryMatcher(prev);
};
exports.wasMatching = wasMatching;
var doesMatchNow = function (input) {
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    var ret = input.queryParams.queryMatcher(doc);
    return ret;
};
exports.doesMatchNow = doesMatchNow;
var wasResultsEmpty = function (input) {
    return input.previousResults.length === 0;
};
exports.wasResultsEmpty = wasResultsEmpty;
//# sourceMappingURL=state-resolver.js.map