"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unknownAction = exports.runFullQueryAgain = exports.removeExistingAndInsertAtSortPosition = exports.insertAtSortPosition = exports.alwaysWrong = exports.replaceExisting = exports.removeExisting = exports.removeLastInsertFirst = exports.removeFirstInsertLast = exports.removeLastItem = exports.removeFirstItem = exports.insertLast = exports.insertFirst = exports.doNothing = void 0;
var array_push_at_sort_position_1 = require("array-push-at-sort-position");
var doNothing = function (_input) { };
exports.doNothing = doNothing;
var insertFirst = function (input) {
    input.previousResults.unshift(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, input.changeEvent.doc);
    }
};
exports.insertFirst = insertFirst;
var insertLast = function (input) {
    input.previousResults.push(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, input.changeEvent.doc);
    }
};
exports.insertLast = insertLast;
var removeFirstItem = function (input) {
    var first = input.previousResults.shift();
    if (input.keyDocumentMap && first) {
        input.keyDocumentMap.delete(first[input.queryParams.primaryKey]);
    }
};
exports.removeFirstItem = removeFirstItem;
var removeLastItem = function (input) {
    var last = input.previousResults.pop();
    if (input.keyDocumentMap && last) {
        input.keyDocumentMap.delete(last[input.queryParams.primaryKey]);
    }
};
exports.removeLastItem = removeLastItem;
var removeFirstInsertLast = function (input) {
    exports.removeFirstItem(input);
    exports.insertLast(input);
};
exports.removeFirstInsertLast = removeFirstInsertLast;
var removeLastInsertFirst = function (input) {
    exports.removeLastItem(input);
    exports.insertFirst(input);
};
exports.removeLastInsertFirst = removeLastInsertFirst;
var removeExisting = function (input) {
    if (input.keyDocumentMap) {
        input.keyDocumentMap.delete(input.changeEvent.id);
    }
    // find index of document
    var primary = input.queryParams.primaryKey;
    var results = input.previousResults;
    for (var i = 0; i < results.length; i++) {
        var item = results[i];
        // remove
        // console.dir(item);
        if (item[primary] === input.changeEvent.id) {
            results.splice(i, 1);
            break;
        }
    }
};
exports.removeExisting = removeExisting;
var replaceExisting = function (input) {
    // find index of document
    var doc = input.changeEvent.doc;
    var primary = input.queryParams.primaryKey;
    var results = input.previousResults;
    for (var i = 0; i < results.length; i++) {
        var item = results[i];
        // replace
        if (item[primary] === input.changeEvent.id) {
            results[i] = doc;
            if (input.keyDocumentMap) {
                input.keyDocumentMap.set(input.changeEvent.id, doc);
            }
            break;
        }
    }
};
exports.replaceExisting = replaceExisting;
/**
 * this function always returns wrong results
 * it must be later optimised out
 * otherwise there is something broken
 */
var alwaysWrong = function (input) {
    var wrongHuman = {
        _id: 'wrongHuman' + new Date().getTime()
    };
    input.previousResults.length = 0; // clear array
    input.previousResults.push(wrongHuman);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.clear();
        input.keyDocumentMap.set(wrongHuman._id, wrongHuman);
    }
};
exports.alwaysWrong = alwaysWrong;
var insertAtSortPosition = function (input) {
    var doc = input.changeEvent.doc;
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, doc);
    }
    array_push_at_sort_position_1.pushAtSortPosition(input.previousResults, doc, input.queryParams.sortComparator, true);
};
exports.insertAtSortPosition = insertAtSortPosition;
var removeExistingAndInsertAtSortPosition = function (input) {
    exports.removeExisting(input);
    exports.insertAtSortPosition(input);
};
exports.removeExistingAndInsertAtSortPosition = removeExistingAndInsertAtSortPosition;
var runFullQueryAgain = function (_input) {
    throw new Error('Action runFullQueryAgain must be implemented by yourself');
};
exports.runFullQueryAgain = runFullQueryAgain;
var unknownAction = function (_input) {
    throw new Error('Action unknownAction should never be called');
};
exports.unknownAction = unknownAction;
//# sourceMappingURL=action-functions.js.map