import type { StateResolveFunctionInput, UNKNOWN, MongoQuery } from './types';
export declare const UNKNOWN_VALUE: UNKNOWN;
export declare function lastOfArray<T>(ar: T[]): T;
/**
 * @link https://stackoverflow.com/a/5915122
 */
export declare function randomOfArray<T>(items: T[]): T;
export declare function shuffleArray<T>(arr: T[]): T[];
/**
 * if the previous doc-data is unknown,
 * try to get it from previous results
 * @mutate the changeEvent of input
 */
export declare function tryToFillPreviousDoc<DocType>(input: StateResolveFunctionInput<DocType>): void;
/**
 * normalizes sort-field
 * in: '-age'
 * out: 'age'
 */
export declare function normalizeSortField(field: string): string;
export declare function getSortFieldsOfQuery(query: MongoQuery): string[];
/**
 *  @link https://stackoverflow.com/a/1431113
 */
export declare function replaceCharAt(str: string, index: number, replacement: string): string;
export declare function mapToObject<K, V>(map: Map<K, V>): {
    [k: string]: V;
};
export declare function objectToMap<K, V>(object: {
    [k: string]: V;
}): Map<K, V>;
export declare function cloneMap<K, V>(map: Map<K, V>): Map<K, V>;
export declare function mergeSets<T>(sets: Set<T>[]): Set<T>;
