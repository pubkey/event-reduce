import type { MongoQuery, DeepReadonlyObject } from './types/index.js';
export declare function lastOfArray<T>(ar: T[]): T;
/**
 * @link https://stackoverflow.com/a/5915122
 */
export declare function randomOfArray<T>(items: T[]): T;
export declare function shuffleArray<T>(arr: T[]): T[];
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
/**
 * does a flat copy on the objects,
 * is about 3 times faster then using deepClone
 * @link https://jsperf.com/object-rest-spread-vs-clone/2
 */
export declare function flatClone<T>(obj: T | DeepReadonlyObject<T>): T;
export declare function ensureNotFalsy<T>(obj: T | false | undefined | null): T;
export declare function mergeSets<T>(sets: Set<T>[]): Set<T>;
/**
 * @link https://stackoverflow.com/a/12830454/3443137
 */
export declare function roundToTwoDecimals(num: number): number;
export declare function isObject(value: null): boolean;
export declare function getProperty(object: any, path: string | string[], value?: any): any;
