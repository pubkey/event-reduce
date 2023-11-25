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
    return str.substr(0, index) + replacement + str.substr(index + replacement.length);
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
        throw new Error('ensureNotFalsy() is falsy');
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

export function getProperty(object: any, path: string | string[], value?: any) {
    if (Array.isArray(path)) {
        path = path.join('.');
    }

    if (!isObject(object as any) || typeof path !== 'string') {
        return value === undefined ? object : value;
    }

    const pathArray = path.split('.');
    if (pathArray.length === 0) {
        return value;
    }

    for (let index = 0; index < pathArray.length; index++) {
        const key = pathArray[index];

        if (isStringIndex(object as any, key as any)) {
            object = index === pathArray.length - 1 ? undefined : null;
        } else {
            object = (object as any)[key];
        }

        if (object === undefined || object === null) {
            // `object` is either `undefined` or `null` so we want to stop the loop, and
            // if this is not the last bit of the path, and
            // if it didn't return `undefined`
            // it would return `null` if `object` is `null`
            // but we want `get({foo: null}, 'foo.bar')` to equal `undefined`, or the supplied value, not `null`
            if (index !== pathArray.length - 1) {
                return value;
            }

            break;
        }
    }

    return object === undefined ? value : object;
}

function isStringIndex(object: any[], key: string) {
    if (typeof key !== 'number' && Array.isArray(object)) {
        const index = Number.parseInt(key, 10);
        return Number.isInteger(index) && object[index] === object[key as any];
    }

    return false;
}
