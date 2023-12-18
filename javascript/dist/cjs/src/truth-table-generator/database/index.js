"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyChangeEvent = void 0;
__exportStar(require("./mingo.js"), exports);
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