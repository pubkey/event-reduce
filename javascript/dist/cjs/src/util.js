"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProperty = exports.isObject = exports.roundToTwoDecimals = exports.mergeSets = exports.ensureNotFalsy = exports.flatClone = exports.cloneMap = exports.objectToMap = exports.mapToObject = exports.replaceCharAt = exports.getSortFieldsOfQuery = exports.normalizeSortField = exports.shuffleArray = exports.randomOfArray = exports.lastOfArray = void 0;
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
    return arr.slice().sort(() => (Math.random() - 0.5));
}
exports.shuffleArray = shuffleArray;
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
    return query.sort.map(maybeArray => {
        if (Array.isArray(maybeArray)) {
            return maybeArray[0].map((field) => normalizeSortField(field));
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
    const ret = {};
    map.forEach((value, key) => {
        ret[key] = value;
    });
    return ret;
}
exports.mapToObject = mapToObject;
function objectToMap(object) {
    const ret = new Map();
    Object.entries(object).forEach(([k, v]) => {
        ret.set(k, v);
    });
    return ret;
}
exports.objectToMap = objectToMap;
function cloneMap(map) {
    const ret = new Map();
    map.forEach((value, key) => {
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
    let ret = new Set();
    sets.forEach(set => {
        ret = new Set([...ret, ...set]);
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
    const type = typeof value;
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
    const pathArray = path.split('.');
    if (pathArray.length === 0) {
        return value;
    }
    for (let index = 0; index < pathArray.length; index++) {
        const key = pathArray[index];
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
        const index = Number.parseInt(key, 10);
        return Number.isInteger(index) && object[index] === object[key];
    }
    return false;
}
//# sourceMappingURL=util.js.map