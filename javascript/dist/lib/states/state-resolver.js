"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var object_path_1 = __importDefault(require("object-path"));
var util_1 = require("../util");
exports.hasLimit = function (input) {
    return !!input.queryParams.limit;
};
exports.isFindOne = function (input) {
    return input.queryParams.limit === 1;
};
exports.hasSkip = function (input) {
    if (input.queryParams.skip && input.queryParams.skip > 0) {
        return true;
    }
    else {
        return false;
    }
};
exports.isDelete = function (input) {
    return input.changeEvent.operation === 'DELETE';
};
exports.isInsert = function (input) {
    return input.changeEvent.operation === 'INSERT';
};
exports.isUpdate = function (input) {
    return input.changeEvent.operation === 'UPDATE';
};
exports.previousUnknown = function (input) {
    return input.changeEvent.previous === util_1.UNKNOWN_VALUE;
};
exports.wasLimitReached = function (input) {
    return exports.hasLimit(input) && input.previousResults.length >= input.queryParams.limit;
};
exports.sortParamsChanged = function (input) {
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
        var beforeData = object_path_1.default.get(prev, field);
        var afterData = object_path_1.default.get(doc, field);
        if (beforeData !== afterData) {
            return true;
        }
    }
    return false;
};
exports.wasInResult = function (input) {
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
exports.wasSortedBeforeFirst = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === util_1.UNKNOWN_VALUE) {
        return false;
    }
    var first = input.previousResults[0];
    if (!first) {
        return false;
    }
    var comp = input.queryParams.sortComparator(prev, first);
    return comp < 0;
};
exports.wasSortedAfterLast = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === util_1.UNKNOWN_VALUE) {
        return false;
    }
    var last = util_1.lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }
    var comp = input.queryParams.sortComparator(prev, last);
    return comp > 0;
};
exports.isSortedBeforeFirst = function (input) {
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
exports.isSortedAfterLast = function (input) {
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    var last = util_1.lastOfArray(input.previousResults);
    if (!last) {
        return false;
    }
    var comp = input.queryParams.sortComparator(doc, last);
    return comp > 0;
};
exports.wasMatching = function (input) {
    var prev = input.changeEvent.previous;
    if (!prev || prev === util_1.UNKNOWN_VALUE) {
        return false;
    }
    return input.queryParams.queryMatcher(prev);
};
exports.doesMatchNow = function (input) {
    var doc = input.changeEvent.doc;
    if (!doc) {
        return false;
    }
    var ret = input.queryParams.queryMatcher(doc);
    return ret;
};
exports.wasResultsEmpty = function (input) {
    return input.previousResults.length === 0;
};
//# sourceMappingURL=state-resolver.js.map