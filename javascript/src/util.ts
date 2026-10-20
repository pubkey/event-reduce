import type {
    MongoQuery,
    DeepReadonlyObject
} from './types/index.js';


export function lastOfArray<T>(ar: T[]): T {
    return ar[ar.length - 1];
}

/**
 * @link https://stackoverflow.com/a/5915122
 */
export function randomOfArray<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}

export function shuffleArray<T>(arr: T[]): T[] {
    return arr.slice().sort(() => (Math.random() - 0.5));
}

/**
 * normalizes sort-field
 * in: '-age'
 * out: 'age'
 */
export function normalizeSortField(field: string | any): string {
    if (typeof field === 'string') {
        if (field.startsWith('-')) {
            return field.slice(1);
        } else {
            return field;
        }
    } else if (Array.isArray(field)) {
        return normalizeSortField(field[0]);
    } else if (typeof field === 'object' && field !== null) {
        return normalizeSortField(Object.keys(field)[0]);
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
            return maybeArray[0].map((field: any) => normalizeSortField(field));
        } else {
            return normalizeSortField(maybeArray);
        }
    });
}

/**
 *  @link https://stackoverflow.com/a/1431113
 */
export function replaceCharAt(str: string, index: number, replacement: string) {
    return str.slice(0, index) + replacement + str.slice(index + replacement.length);
}

export function mapToObject<K, V>(map: Map<K, V>): {
    [k: string]: V
} {
    const ret: any = {};
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

export function cloneMap<K, V>(map: Map<K, V>): Map<K, V> {
    const ret: any = new Map();
    map.forEach(
        (value: V, key: K) => {
            ret[key as any] = value;
        }
    );
    return ret;
}

/**
 * does a flat copy on the objects,
 * is about 3 times faster then using deepClone
 * @link https://jsperf.com/object-rest-spread-vs-clone/2
 */
export function flatClone<T>(obj: T | DeepReadonlyObject<T>): T {
    return Object.assign({}, obj) as any;
}

export function ensureNotFalsy<T>(obj: T | false | undefined | null): T {
    if (!obj) {
        throw new Error('EventReduce:FALSY');
    }
    return obj;
}

export function mergeSets<T>(sets: Set<T>[]): Set<T> {
    let ret: Set<T> = new Set();
    sets.forEach(set => {
        ret = new Set([...ret, ...set]);
    });
    return ret;
}

/**
 * @link https://stackoverflow.com/a/12830454/3443137
 */
export function roundToTwoDecimals(num: number): number {
    return parseFloat(num.toFixed(2));
}


export function isObject(value: null) {
    const type = typeof value;
    return value !== null && (type === 'object' || type === 'function');
}

/**
 * Returns the value at the dot-separated path like 'items.0.rank'.
 * Array entries are accessed by their index.
 * Returns the given default value if the path does not exist.
 */
export function getProperty(object: any, path: string | string[], value?: any) {
    const pathArray = Array.isArray(path) ? path : path.split('.');
    for (let i = 0; i < pathArray.length; i++) {
        if (object === undefined || object === null) {
            return value;
        }
        object = object[pathArray[i]];
    }
    return object === undefined ? value : object;
}
