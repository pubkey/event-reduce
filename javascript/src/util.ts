import {
    StateResolveFunctionInput
} from './types';
import { MongoQuery } from './logic-generator/types';
import { UNKNOWN_VALUE } from './logic-generator/config';
import * as fs from 'fs';

export function lastOfArray<T>(ar: T[]): T {
    return ar[ar.length - 1];
}

/**
 * @link https://stackoverflow.com/a/5915122
 */
export function randomOfArray<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}

/**
 * if the previous doc-data is unknown,
 * try to get it from previous results
 * @mutate the changeEvent of input
 */
export function tryToFillPreviousDoc<DocType>(
    input: StateResolveFunctionInput<DocType>
) {
    const prev = input.changeEvent.previous;
    if (prev === UNKNOWN_VALUE) {
        const id = input.changeEvent.id;
        const primary = input.queryParams.primaryKey;
        if (input.keyDocumentMap) {
            const doc = input.keyDocumentMap.get(id);
            if (doc) {
                input.changeEvent.previous = doc;
            }
        } else {
            const found = input.previousResults.find(item => item[primary] === id);
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
export function normalizeSortField(field: string): string {
    if (field.startsWith('-')) {
        return field.substr(1);
    } else {
        return field;
    }
}

export function getSortFieldsOfQuery(query: MongoQuery): string[] {
    if (!query.sort) {
        // if no sort-order is set, use the primary key
        return ['_id'];
    }
    return query.sort.map(maybeArray => {
        if (Array.isArray(maybeArray)) {
            return maybeArray[0].map(field => normalizeSortField(field));
        } else {
            return normalizeSortField(maybeArray);
        }
    });
}

/**
 *  @link https://stackoverflow.com/a/1431113
 */
export function replaceCharAt(str: string, index: number, replacement: string) {
    return str.substr(0, index) + replacement + str.substr(index + replacement.length);
}

export function mapToObject<K, V>(map: Map<K, V>): {
    [k: string]: V
} {
    const ret = {};
    map.forEach(
        (value: V, key: K) => {
            ret[key as any] = value;
        }
    );
    return ret;
}

export function objectToMap<K, V>(object: {
    [k: string]: V
}): Map<K, V> {
    const ret = new Map();
    Object.entries(object).forEach(([k, v]) => {
        ret.set(k, v);
    });
    return ret;
}

export function mergeSets<T>(sets: Set<T>[]): Set<T> {
    let ret: Set<T> = new Set();
    sets.forEach(set => {
        ret = new Set([...ret, ...set]);
    });
    return ret;
}

export function readJsonFile(path: string): any {
    const content = fs.readFileSync(path, 'utf-8');
    return JSON.parse(content);
}

export function writeJsonFile(
    path: string,
    data: any
) {
    fs.writeFileSync(
        path,
        JSON.stringify(data, null, 2),
        { encoding: 'utf8', flag: 'w' }
    );
}
