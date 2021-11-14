"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStateSet = exports.getStateSet = exports.resolveState = exports.stateResolveFunctionByIndex = exports.stateResolveFunctions = exports.orderedStateList = void 0;
var state_resolver_1 = require("./state-resolver");
__exportStar(require("./state-resolver"), exports);
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
    'wasFirst',
    'wasLast',
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
    wasFirst: state_resolver_1.wasFirst,
    wasLast: state_resolver_1.wasLast,
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
    9: state_resolver_1.wasFirst,
    10: state_resolver_1.wasLast,
    11: state_resolver_1.sortParamsChanged,
    12: state_resolver_1.wasInResult,
    13: state_resolver_1.wasSortedBeforeFirst,
    14: state_resolver_1.wasSortedAfterLast,
    15: state_resolver_1.isSortedBeforeFirst,
    16: state_resolver_1.isSortedAfterLast,
    17: state_resolver_1.wasMatching,
    18: state_resolver_1.doesMatchNow
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