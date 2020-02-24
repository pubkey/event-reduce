import {
    MongoQuery,
    Human,
    IdToDocumentMap
} from './types';


/**
 * @link https://stackoverflow.com/a/5915122
 */
export function randomOfArray<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)];
}

export function idToDocMapFromList(docs: Human[]): IdToDocumentMap {
    const map: IdToDocumentMap = new Map();
    docs.forEach(doc => map.set(doc._id, doc));
    return map;
}
