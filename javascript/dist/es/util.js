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
export var UNKNOWN_VALUE = 'UNKNOWN';
export function lastOfArray(ar) {
    return ar[ar.length - 1];
}
/**
 * @link https://stackoverflow.com/a/5915122
 */
export function randomOfArray(items) {
    return items[Math.floor(Math.random() * items.length)];
}
export function shuffleArray(arr) {
    return arr.slice().sort(function () { return (Math.random() - 0.5); });
}
/**
 * if the previous doc-data is unknown,
 * try to get it from previous results
 * @mutate the changeEvent of input
 */
export function tryToFillPreviousDoc(input) {
    var prev = input.changeEvent.previous;
    if (prev === UNKNOWN_VALUE) {
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
/**
 * normalizes sort-field
 * in: '-age'
 * out: 'age'
 */
export function normalizeSortField(field) {
    if (field.startsWith('-')) {
        return field.substr(1);
    }
    else {
        return field;
    }
}
export function getSortFieldsOfQuery(query) {
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
/**
 *  @link https://stackoverflow.com/a/1431113
 */
export function replaceCharAt(str, index, replacement) {
    return str.substr(0, index) + replacement + str.substr(index + replacement.length);
}
export function mapToObject(map) {
    var ret = {};
    map.forEach(function (value, key) {
        ret[key] = value;
    });
    return ret;
}
export function objectToMap(object) {
    var ret = new Map();
    Object.entries(object).forEach(function (_a) {
        var _b = __read(_a, 2), k = _b[0], v = _b[1];
        ret.set(k, v);
    });
    return ret;
}
export function cloneMap(map) {
    var ret = new Map();
    map.forEach(function (value, key) {
        ret[key] = value;
    });
    return ret;
}
/**
 * does a flat copy on the objects,
 * is about 3 times faster then using deepClone
 * @link https://jsperf.com/object-rest-spread-vs-clone/2
 */
export function flatClone(obj) {
    return Object.assign({}, obj);
}
export function ensureNotFalsy(obj) {
    if (!obj) {
        throw new Error('ensureNotFalsy() is falsy');
    }
    return obj;
}
export function mergeSets(sets) {
    var ret = new Set();
    sets.forEach(function (set) {
        ret = new Set(__spreadArray(__spreadArray([], __read(ret), false), __read(set), false));
    });
    return ret;
}
/**
 * @link https://stackoverflow.com/a/12830454/3443137
 */
export function roundToTwoDecimals(num) {
    return parseFloat(num.toFixed(2));
}
//# sourceMappingURL=util.js.map