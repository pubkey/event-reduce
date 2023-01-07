"use strict";
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProperty = exports.isObject = exports.roundToTwoDecimals = exports.mergeSets = exports.ensureNotFalsy = exports.flatClone = exports.cloneMap = exports.objectToMap = exports.mapToObject = exports.replaceCharAt = exports.getSortFieldsOfQuery = exports.normalizeSortField = exports.tryToFillPreviousDoc = exports.shuffleArray = exports.randomOfArray = exports.lastOfArray = exports.UNKNOWN_VALUE = void 0;
exports.UNKNOWN_VALUE = 'UNKNOWN';
function lastOfArray(ar) {
    return ar[ar.length - 1];
}
exports.lastOfArray = lastOfArray;
/**
 * @link https://stackoverflow.com/a/5915122
 */
function randomOfArray(items) {
    return items[Math.floor(Math.random() * items.length)];
}
exports.randomOfArray = randomOfArray;
function shuffleArray(arr) {
    return arr.slice().sort(function () { return (Math.random() - 0.5); });
}
exports.shuffleArray = shuffleArray;
/**
 * if the previous doc-data is unknown,
 * try to get it from previous results
 * @mutate the changeEvent of input
 */
function tryToFillPreviousDoc(input) {
    var prev = input.changeEvent.previous;
    if (prev === exports.UNKNOWN_VALUE) {
        var id_1 = input.changeEvent.id;
        var primary_1 = input.queryParams.primaryKey;
        if (input.keyDocumentMap) {
            var doc = input.keyDocumentMap.get(id_1);
            if (doc) {
                input.changeEvent.previous = doc;
            }
        }
        else {
            var found = input.previousResults.find(function (item) { return item[primary_1] === id_1; });
            if (found) {
                input.changeEvent.previous = found;
            }
        }
    }
}
exports.tryToFillPreviousDoc = tryToFillPreviousDoc;
/**
 * normalizes sort-field
 * in: '-age'
 * out: 'age'
 */
function normalizeSortField(field) {
    if (field.startsWith('-')) {
        return field.substr(1);
    }
    else {
        return field;
    }
}
exports.normalizeSortField = normalizeSortField;
function getSortFieldsOfQuery(query) {
    if (!query.sort) {
        // if no sort-order is set, use the primary key
        return ['_id'];
    }
    return query.sort.map(function (maybeArray) {
        if (Array.isArray(maybeArray)) {
            return maybeArray[0].map(function (field) { return normalizeSortField(field); });
        }
        else {
            return normalizeSortField(maybeArray);
        }
    });
}
exports.getSortFieldsOfQuery = getSortFieldsOfQuery;
/**
 *  @link https://stackoverflow.com/a/1431113
 */
function replaceCharAt(str, index, replacement) {
    return str.substr(0, index) + replacement + str.substr(index + replacement.length);
}
exports.replaceCharAt = replaceCharAt;
function mapToObject(map) {
    var ret = {};
    map.forEach(function (value, key) {
        ret[key] = value;
    });
    return ret;
}
exports.mapToObject = mapToObject;
function objectToMap(object) {
    var ret = new Map();
    Object.entries(object).forEach(function (_a) {
        var _b = __read(_a, 2), k = _b[0], v = _b[1];
        ret.set(k, v);
    });
    return ret;
}
exports.objectToMap = objectToMap;
function cloneMap(map) {
    var ret = new Map();
    map.forEach(function (value, key) {
        ret[key] = value;
    });
    return ret;
}
exports.cloneMap = cloneMap;
/**
 * does a flat copy on the objects,
 * is about 3 times faster then using deepClone
 * @link https://jsperf.com/object-rest-spread-vs-clone/2
 */
function flatClone(obj) {
    return Object.assign({}, obj);
}
exports.flatClone = flatClone;
function ensureNotFalsy(obj) {
    if (!obj) {
        throw new Error('ensureNotFalsy() is falsy');
    }
    return obj;
}
exports.ensureNotFalsy = ensureNotFalsy;
function mergeSets(sets) {
    var ret = new Set();
    sets.forEach(function (set) {
        ret = new Set(__spreadArray(__spreadArray([], __read(ret), false), __read(set), false));
    });
    return ret;
}
exports.mergeSets = mergeSets;
/**
 * @link https://stackoverflow.com/a/12830454/3443137
 */
function roundToTwoDecimals(num) {
    return parseFloat(num.toFixed(2));
}
exports.roundToTwoDecimals = roundToTwoDecimals;
function isObject(value) {
    var type = typeof value;
    return value !== null && (type === 'object' || type === 'function');
}
exports.isObject = isObject;
function getProperty(object, path, value) {
    if (Array.isArray(path)) {
        path = path.join('.');
    }
    if (!isObject(object) || typeof path !== 'string') {
        return value === undefined ? object : value;
    }
    var pathArray = path.split('.');
    if (pathArray.length === 0) {
        return value;
    }
    for (var index = 0; index < pathArray.length; index++) {
        var key = pathArray[index];
        if (isStringIndex(object, key)) {
            object = index === pathArray.length - 1 ? undefined : null;
        }
        else {
            object = object[key];
        }
        if (object === undefined || object === null) {
            // `object` is either `undefined` or `null` so we want to stop the loop, and
            // if this is not the last bit of the path, and
            // if it didn't return `undefined`
            // it would return `null` if `object` is `null`
            // but we want `get({foo: null}, 'foo.bar')` to equal `undefined`, or the supplied value, not `null`
            if (index !== pathArray.length - 1) {
                return value;
            }
            break;
        }
    }
    return object === undefined ? value : object;
}
exports.getProperty = getProperty;
function isStringIndex(object, key) {
    if (typeof key !== 'number' && Array.isArray(object)) {
        var index = Number.parseInt(key, 10);
        return Number.isInteger(index) && object[index] === object[key];
    }
    return false;
}
//# sourceMappingURL=util.js.map