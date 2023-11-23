import {
    randomBoolean,
    randomNumber
} from 'async-test-util';

import type {
    MongoQuery
} from '../types/index.ts';
import { randomOfArray } from '../util.ts';

export const DEFAULT_EXAMPLE_QUERY: MongoQuery = {
    selector: {},
    limit: 100,
    sort: ['_id']
};

export const findAllQuery: MongoQuery = {
    selector: {},
    sort: ['_id']
};


export const SELECTOR_VARIATIONS: Partial<MongoQuery>[] = [
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

export const SKIP_VARIATIONS: { skip: number | undefined }[] = [
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

export const LIMIT_VARIATIONS: { limit: number | undefined }[] = [
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

export const SORT_VARIATION: { sort: string[] }[] = [
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
export const QUERIES_FROM_FUZZING: MongoQuery[] = [
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

let QUERY_VARIATIONS_CACHE: MongoQuery[];
export function getQueryVariations(): MongoQuery[] {
    if (!QUERY_VARIATIONS_CACHE) {
        QUERY_VARIATIONS_CACHE = [];
        SELECTOR_VARIATIONS.forEach(selectorV => {
            SKIP_VARIATIONS.forEach(skipV => {
                LIMIT_VARIATIONS.forEach(limitV => {
                    SORT_VARIATION.forEach(sortV => {
                        const query = Object.assign(
                            {},
                            selectorV,
                            skipV,
                            limitV,
                            sortV
                        );
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



export function randomQuery(): MongoQuery {
    const selector = randomOfArray(SELECTOR_VARIATIONS);
    const skip = randomBoolean() ? randomNumber(1, 30) : undefined;
    const limit = randomBoolean() ? randomNumber(1, 30) : undefined;
    const sort = randomOfArray(SORT_VARIATION);
    return {
        selector: selector.selector,
        skip,
        limit,
        sort: sort.sort
    };
}
