"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var state_resolver_1 = require("./state-resolver");
/**
 * all states ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
exports.orderedStateList = [
    'isInsert',
    'isUpdate',
    'isDelete',
    'hasLimit',
    'isFindOne',
    'hasSkip',
    'wasResultsEmpty',
    'previousUnknown',
    'wasLimitReached',
    'sortParamsChanged',
    'wasInResult',
    'wasSortedBeforeFirst',
    'wasSortedAfterLast',
    'isSortedBeforeFirst',
    'isSortedAfterLast',
    'wasMatching',
    'doesMatchNow'
];
exports.stateResolveFunctions = {
    isInsert: state_resolver_1.isInsert,
    isUpdate: state_resolver_1.isUpdate,
    isDelete: state_resolver_1.isDelete,
    hasLimit: state_resolver_1.hasLimit,
    isFindOne: state_resolver_1.isFindOne,
    hasSkip: state_resolver_1.hasSkip,
    wasResultsEmpty: state_resolver_1.wasResultsEmpty,
    previousUnknown: state_resolver_1.previousUnknown,
    wasLimitReached: state_resolver_1.wasLimitReached,
    sortParamsChanged: state_resolver_1.sortParamsChanged,
    wasInResult: state_resolver_1.wasInResult,
    wasSortedBeforeFirst: state_resolver_1.wasSortedBeforeFirst,
    wasSortedAfterLast: state_resolver_1.wasSortedAfterLast,
    isSortedBeforeFirst: state_resolver_1.isSortedBeforeFirst,
    isSortedAfterLast: state_resolver_1.isSortedAfterLast,
    wasMatching: state_resolver_1.wasMatching,
    doesMatchNow: state_resolver_1.doesMatchNow
};
exports.stateResolveFunctionByIndex = {
    0: state_resolver_1.isInsert,
    1: state_resolver_1.isUpdate,
    2: state_resolver_1.isDelete,
    3: state_resolver_1.hasLimit,
    4: state_resolver_1.isFindOne,
    5: state_resolver_1.hasSkip,
    6: state_resolver_1.wasResultsEmpty,
    7: state_resolver_1.previousUnknown,
    8: state_resolver_1.wasLimitReached,
    9: state_resolver_1.sortParamsChanged,
    10: state_resolver_1.wasInResult,
    11: state_resolver_1.wasSortedBeforeFirst,
    12: state_resolver_1.wasSortedAfterLast,
    13: state_resolver_1.isSortedBeforeFirst,
    14: state_resolver_1.isSortedAfterLast,
    15: state_resolver_1.wasMatching,
    16: state_resolver_1.doesMatchNow
};
function resolveState(stateName, input) {
    var fn = exports.stateResolveFunctions[stateName];
    if (!fn) {
        throw new Error('resolveState() has no function for ' + stateName);
    }
    return fn(input);
}
exports.resolveState = resolveState;
function getStateSet(input) {
    var set = '';
    for (var i = 0; i < exports.orderedStateList.length; i++) {
        var name_1 = exports.orderedStateList[i];
        var value = resolveState(name_1, input);
        var add = value ? '1' : '0';
        set += add;
    }
    return set;
}
exports.getStateSet = getStateSet;
function logStateSet(stateSet) {
    exports.orderedStateList.forEach(function (state, index) {
        console.log('state: ' + state + ' : ' + stateSet[index]);
    });
}
exports.logStateSet = logStateSet;
//# sourceMappingURL=index.js.map