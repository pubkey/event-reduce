export * from './mingo.js';
export function applyChangeEvent(collection, changeEvent) {
    switch (changeEvent.operation) {
        case 'INSERT':
            collection.upsert(changeEvent.doc);
            break;
        case 'UPDATE':
            collection.upsert(changeEvent.doc);
            break;
        case 'DELETE':
            collection.remove(changeEvent.id);
            break;
    }
}
//# sourceMappingURL=index.js.map