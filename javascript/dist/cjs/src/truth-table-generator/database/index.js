"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyChangeEvent = void 0;
function applyChangeEvent(collection, changeEvent) {
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
exports.applyChangeEvent = applyChangeEvent;
//# sourceMappingURL=index.js.map