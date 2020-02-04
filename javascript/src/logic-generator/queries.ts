import {
    MongoQuery
} from './types';

export const DEFAULT_EXAMPLE_QUERY: MongoQuery = {
    selector: {},
    limit: 100,
    sort: ['_id']
};

export const findAllQuery: MongoQuery = {
    selector: {}
};


export const SELECTOR_VARIATIONS: MongoQuery[] = [
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

export const SORT_VARIATION: { sort: string[] | string[][] }[] = [
    // sort by immutable primary
    {
        sort: ['_id']
    },
    // sort by mutable age
    {
        sort: ['age']
    },
    // sort reverse
    {
        sort: ['-age']
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
    }
    return QUERY_VARIATIONS_CACHE;
}
