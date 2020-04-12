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
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
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
export function mergeSets(sets) {
    var ret = new Set();
    sets.forEach(function (set) {
        ret = new Set(__spread(ret, set));
    });
    return ret;
}
//# sourceMappingURL=util.js.map