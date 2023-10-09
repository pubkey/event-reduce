"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomQuery = exports.getQueryVariations = exports.QUERIES_FROM_FUZZING = exports.SORT_VARIATION = exports.LIMIT_VARIATIONS = exports.SKIP_VARIATIONS = exports.SELECTOR_VARIATIONS = exports.findAllQuery = exports.DEFAULT_EXAMPLE_QUERY = void 0;
const async_test_util_1 = require("async-test-util");
const util_js_1 = require("../util.js");
exports.DEFAULT_EXAMPLE_QUERY = {
    selector: {},
    limit: 100,
    sort: ['_id']
};
exports.findAllQuery = {
    selector: {},
    sort: ['_id']
};
exports.SELECTOR_VARIATIONS = [
    // find all
    exports.findAllQuery,
    // find none
    {
        selector: {
            gender: 'x'
        }
    },
    // find half of all
    {
        selector: {
            gender: 'm'
        }
    },
    // find 10%
    {
        selector: {
            age: {
                $gt: 10
            }
        }
    },
    // find 20%
    {
        selector: {
            age: {
                $gt: 20
            }
        }
    },
    // find 90%
    {
        selector: {
            age: {
                $gt: 90
            }
        }
    }
];
exports.SKIP_VARIATIONS = [
    // no skip
    {
        skip: undefined
    },
    // skip all
    {
        skip: 10000
    },
    // skip few
    {
        skip: 5
    },
    // skip many
    {
        skip: 15
    }
];
exports.LIMIT_VARIATIONS = [
    // no limit
    {
        limit: undefined
    },
    // limit one
    {
        limit: 1
    },
    // limit two
    {
        limit: 2
    },
    // limit few
    {
        limit: 5
    },
    // limit many
    {
        limit: 15
    }
];
exports.SORT_VARIATION = [
    // sort by immutable primary
    {
        sort: ['_id']
    },
    // sort by mutable age
    {
        sort: ['age', '_id']
    },
    // sort reverse
    {
        sort: ['-age', '_id']
    }
];
// edge-cases we found by fuzzing
exports.QUERIES_FROM_FUZZING = [
    {
        selector: {
            gender: 'm'
        },
        limit: 22,
        sort: [
            '_id'
        ]
    }, {
        selector: {
            gender: 'm'
        },
        limit: 21,
        sort: [
            '-age',
            '_id'
        ]
    }, {
        selector: {},
        skip: 3,
        limit: 3,
        sort: ['age', '_id']
    }
];
let QUERY_VARIATIONS_CACHE;
function getQueryVariations() {
    if (!QUERY_VARIATIONS_CACHE) {
        QUERY_VARIATIONS_CACHE = [];
        exports.SELECTOR_VARIATIONS.forEach(selectorV => {
            exports.SKIP_VARIATIONS.forEach(skipV => {
                exports.LIMIT_VARIATIONS.forEach(limitV => {
                    exports.SORT_VARIATION.forEach(sortV => {
                        const query = Object.assign({}, selectorV, skipV, limitV, sortV);
                        QUERY_VARIATIONS_CACHE.push(query);
                    });
                });
            });
        });
        exports.QUERIES_FROM_FUZZING.forEach(query => {
            QUERY_VARIATIONS_CACHE.push(query);
        });
    }
    return QUERY_VARIATIONS_CACHE;
}
exports.getQueryVariations = getQueryVariations;
function randomQuery() {
    const selector = (0, util_js_1.randomOfArray)(exports.SELECTOR_VARIATIONS);
    const skip = (0, async_test_util_1.randomBoolean)() ? (0, async_test_util_1.randomNumber)(1, 30) : undefined;
    const limit = (0, async_test_util_1.randomBoolean)() ? (0, async_test_util_1.randomNumber)(1, 30) : undefined;
    const sort = (0, util_js_1.randomOfArray)(exports.SORT_VARIATION);
    return {
        selector: selector.selector,
        skip,
        limit,
        sort: sort.sort
    };
}
exports.randomQuery = randomQuery;
//# sourceMappingURL=queries.js.map