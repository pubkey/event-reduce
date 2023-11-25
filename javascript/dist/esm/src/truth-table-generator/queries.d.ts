import type { MongoQuery } from '../types/index.js';
export declare const DEFAULT_EXAMPLE_QUERY: MongoQuery;
export declare const findAllQuery: MongoQuery;
export declare const SELECTOR_VARIATIONS: Partial<MongoQuery>[];
export declare const SKIP_VARIATIONS: {
    skip: number | undefined;
}[];
export declare const LIMIT_VARIATIONS: {
    limit: number | undefined;
}[];
export declare const SORT_VARIATION: {
    sort: string[];
}[];
export declare const QUERIES_FROM_FUZZING: MongoQuery[];
export declare function getQueryVariations(): MongoQuery[];
export declare function randomOperation(): string;
export declare function randomSelector(): any;
export declare function randomQuery(): MongoQuery;
