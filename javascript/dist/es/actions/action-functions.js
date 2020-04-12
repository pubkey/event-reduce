import { pushAtSortPosition } from 'array-push-at-sort-position';
export var doNothing = function (_input) { };
export var insertFirst = function (input) {
    input.previousResults.unshift(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, input.changeEvent.doc);
    }
};
export var insertLast = function (input) {
    input.previousResults.push(input.changeEvent.doc);
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, input.changeEvent.doc);
    }
};
export var removeFirstItem = function (input) {
    var first = input.previousResults.shift();
    if (input.keyDocumentMap && first) {
        input.keyDocumentMap.delete(first[input.queryParams.primaryKey]);
    }
};
export var removeLastItem = function (input) {
    var last = input.previousResults.pop();
    if (input.keyDocumentMap && last) {
        input.keyDocumentMap.delete(last[input.queryParams.primaryKey]);
    }
};
export var removeFirstInsertLast = function (input) {
    removeFirstItem(input);
    insertLast(input);
};
export var removeLastInsertFirst = function (input) {
    removeLastItem(input);
    insertFirst(input);
};
export var removeExisting = function (input) {
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
export var replaceExisting = function (input) {
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
/**
 * this function always returns wrong results
 * it must be later optimised out
 * otherwise there is something broken
 */
export var alwaysWrong = function (input) {
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
export var insertAtSortPosition = function (input) {
    var doc = input.changeEvent.doc;
    if (input.keyDocumentMap) {
        input.keyDocumentMap.set(input.changeEvent.id, doc);
    }
    pushAtSortPosition(input.previousResults, doc, input.queryParams.sortComparator, true);
};
export var removeExistingAndInsertAtSortPosition = function (input) {
    removeExisting(input);
    insertAtSortPosition(input);
};
export var runFullQueryAgain = function (_input) {
    throw new Error('Action runFullQueryAgain must be implemented by yourself');
};
export var unknownAction = function (_input) {
    throw new Error('Action unknownAction should never be called');
};
//# sourceMappingURL=action-functions.js.map