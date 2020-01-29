import Faker from 'faker';
import {
    MongoQuery
} from './types';

export const findAllQuery: MongoQuery = {
    selector: {}
};

export const findBasicMatchQuery: MongoQuery = {
    selector: {
        gender: 'm'
    }
};

export const findNoneQuery: MongoQuery = {
    selector: {
        _id: Faker.random.alphaNumeric()
    }
}

export const findOneQuery: MongoQuery = {
    selector: {},
    limit: 1
};

export const findSortedQuery: MongoQuery = {
    selector: {
        age: {
            $gt: 20
        }
    },
    limit: 1,
    sort: [
        'age'
    ]
};

export const findMultiSortedQuery: MongoQuery = {
    selector: {
        age: {
            $gt: 20
        }
    },
    limit: 1,
    sort: [
        'age',
        ['gender', 'desc']
    ]
};

export const findSkippedButRestQuery: MongoQuery = {
    selector: {
        age: {
            $gt: 20
        }
    },
    skip: 10
};


export const findSkippedAndLimitedQuery: MongoQuery = {
    selector: {
        age: {
            $gt: 20
        }
    },
    skip: 10,
    limit: 10
};

export const allQueries: MongoQuery[] = [
    findAllQuery,
    findBasicMatchQuery,
    findNoneQuery,
    findOneQuery,
    findSortedQuery,
    findMultiSortedQuery,
    findSkippedButRestQuery,
    findSkippedAndLimitedQuery
];

