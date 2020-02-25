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


/**
 * @link https://stackoverflow.com/a/3364546
 */
export function removeOptions(selectbox) {
    let i;
    for (i = selectbox.options.length - 1; i >= 0; i--) {
        selectbox.remove(i);
    }
}


// @link https://stackoverflow.com/a/901144/3443137
export function getParameterByName(name, url?) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}