"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMingoSortComparator = exports.mingoCollectionCreator = void 0;
const util_js_1 = require("../../util.js");
const mingo_1 = require("mingo");
const util_1 = require("mingo/util");
const util_js_2 = require("../../util.js");
function mingoCollectionCreator() {
    const data = [];
    const collection = {
        upsert(docData) {
            this.remove(docData._id);
            data.push(docData);
        },
        remove(docId) {
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                if (item._id === docId) {
                    data.splice(i, 1);
                    break;
                }
            }
        },
        getQueryParams(query) {
            const queryInstance = new mingo_1.Query(query.selector);
            return {
                primaryKey: '_id',
                skip: query.skip ? query.skip : undefined,
                limit: query.limit ? query.limit : undefined,
                queryMatcher: d => queryInstance.test(d),
                sortFields: (0, util_js_1.getSortFieldsOfQuery)(query),
                sortComparator: getMingoSortComparator(query)
            };
        },
        query(query) {
            const queryInstance = new mingo_1.Query(query.selector);
            const queryParams = this.getQueryParams(query);
            const skip = query.skip ? query.skip : 0;
            const limit = query.limit ? query.limit : Infinity;
            const skipPlusLimit = skip + limit;
            let rows = data
                .filter(d => queryInstance.test(d))
                .sort(queryParams.sortComparator);
            rows = rows.slice(skip, skipPlusLimit);
            return rows;
        }
    };
    return collection;
}
exports.mingoCollectionCreator = mingoCollectionCreator;
function getMingoSortComparator(query) {
    if (!query.sort) {
        throw new Error('no sort given');
    }
    const sortParts = [];
    query.sort.forEach((key) => {
        const direction = key.startsWith('-') ? 'desc' : 'asc';
        sortParts.push({
            key,
            direction: direction,
            getValueFn: (obj) => (0, util_js_2.getProperty)(obj, key)
        });
    });
    const fun = (a, b) => {
        for (let i = 0; i < sortParts.length; ++i) {
            const sortPart = sortParts[i];
            const valueA = sortPart.getValueFn(a);
            const valueB = sortPart.getValueFn(b);
            if (valueA !== valueB) {
                const ret = sortPart.direction === 'asc' ? (0, util_1.compare)(valueA, valueB) : (0, util_1.compare)(valueB, valueA);
                return ret;
            }
        }
    };
    return fun;
}
exports.getMingoSortComparator = getMingoSortComparator;
//# sourceMappingURL=mingo.js.map