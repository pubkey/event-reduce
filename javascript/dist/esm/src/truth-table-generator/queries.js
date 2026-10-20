import { randomBoolean, randomNumber, randomString } from 'async-test-util';
import { randomOfArray } from '../util.js';
import { HUMAN_MAX_AGE } from './data-generator.js';
export const DEFAULT_EXAMPLE_QUERY = {
    selector: {},
    limit: 100,
    sort: ['_id']
};
export const findAllQuery = {
    selector: {},
    sort: ['_id']
};
export const SELECTOR_VARIATIONS = [
    // find all
    findAllQuery,
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
    // find 20%
    {
        selector: {
            age: {
                $gt: Math.ceil(HUMAN_MAX_AGE * 0.2)
            }
        }
    },
    // find 90%
    {
        selector: {
            age: {
                $gt: Math.ceil(HUMAN_MAX_AGE * 0.9)
            }
        }
    },
    /**
     * Multiple operators
     */
];
export const SKIP_VARIATIONS = [
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
export const LIMIT_VARIATIONS = [
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
export const SORT_VARIATION = [
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
export const QUERIES_FROM_FUZZING = [
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
export function getQueryVariations() {
    if (!QUERY_VARIATIONS_CACHE) {
        QUERY_VARIATIONS_CACHE = [];
        SELECTOR_VARIATIONS.forEach(selectorV => {
            SKIP_VARIATIONS.forEach(skipV => {
                LIMIT_VARIATIONS.forEach(limitV => {
                    SORT_VARIATION.forEach(sortV => {
                        const query = Object.assign({}, selectorV, skipV, limitV, sortV);
                        QUERY_VARIATIONS_CACHE.push(query);
                    });
                });
            });
        });
        QUERIES_FROM_FUZZING.forEach(query => {
            QUERY_VARIATIONS_CACHE.push(query);
        });
    }
    return QUERY_VARIATIONS_CACHE;
}
export function randomOperation() {
    return randomOfArray([
        '$gt',
        '$gte',
        '$eq',
        '$lt',
        '$lte'
    ]);
}
export function randomSelector() {
    const selector = {};
    if (randomBoolean()) {
        selector.age = {
            [randomOperation()]: randomNumber(1, HUMAN_MAX_AGE)
        };
        if (randomBoolean()) {
            selector.age[randomOperation()] = randomNumber(1, HUMAN_MAX_AGE);
        }
    }
    if (randomBoolean()) {
        selector.gender = {
            [randomOperation()]: randomOfArray(['f', 'm', 'x'])
        };
        if (randomBoolean()) {
            selector.gender[randomOperation()] = randomOfArray(['f', 'm', 'x']);
        }
    }
    if (randomBoolean()) {
        selector.name = {
            [randomOperation()]: randomString(10)
        };
        if (randomBoolean()) {
            selector.name[randomOperation()] = randomString(10);
        }
    }
    return selector;
}
export function randomQuery() {
    const selector = randomSelector();
    const skip = randomBoolean() ? randomNumber(1, 25) : undefined;
    const limit = randomBoolean() ? randomNumber(1, 25) : undefined;
    const sort = randomOfArray(SORT_VARIATION);
    const randomQuery = {
        selector,
        skip,
        limit,
        sort: sort.sort
    };
    return randomQuery;
}
//# sourceMappingURL=queries.js.map