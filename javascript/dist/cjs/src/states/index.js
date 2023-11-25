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
exports.logStateSet = exports.getStateSet = exports.resolveState = exports.stateResolveFunctionByIndex = exports.stateResolveFunctions = exports.orderedStateList = void 0;
const state_resolver_js_1 = require("./state-resolver.js");
__exportStar(require("./state-resolver.js"), exports);
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
    isInsert: state_resolver_js_1.isInsert,
    isUpdate: state_resolver_js_1.isUpdate,
    isDelete: state_resolver_js_1.isDelete,
    hasLimit: state_resolver_js_1.hasLimit,
    isFindOne: state_resolver_js_1.isFindOne,
    hasSkip: state_resolver_js_1.hasSkip,
    wasResultsEmpty: state_resolver_js_1.wasResultsEmpty,
    wasLimitReached: state_resolver_js_1.wasLimitReached,
    wasFirst: state_resolver_js_1.wasFirst,
    wasLast: state_resolver_js_1.wasLast,
    sortParamsChanged: state_resolver_js_1.sortParamsChanged,
    wasInResult: state_resolver_js_1.wasInResult,
    wasSortedBeforeFirst: state_resolver_js_1.wasSortedBeforeFirst,
    wasSortedAfterLast: state_resolver_js_1.wasSortedAfterLast,
    isSortedBeforeFirst: state_resolver_js_1.isSortedBeforeFirst,
    isSortedAfterLast: state_resolver_js_1.isSortedAfterLast,
    wasMatching: state_resolver_js_1.wasMatching,
    doesMatchNow: state_resolver_js_1.doesMatchNow
};
exports.stateResolveFunctionByIndex = {
    0: state_resolver_js_1.isInsert,
    1: state_resolver_js_1.isUpdate,
    2: state_resolver_js_1.isDelete,
    3: state_resolver_js_1.hasLimit,
    4: state_resolver_js_1.isFindOne,
    5: state_resolver_js_1.hasSkip,
    6: state_resolver_js_1.wasResultsEmpty,
    7: state_resolver_js_1.wasLimitReached,
    8: state_resolver_js_1.wasFirst,
    9: state_resolver_js_1.wasLast,
    10: state_resolver_js_1.sortParamsChanged,
    11: state_resolver_js_1.wasInResult,
    12: state_resolver_js_1.wasSortedBeforeFirst,
    13: state_resolver_js_1.wasSortedAfterLast,
    14: state_resolver_js_1.isSortedBeforeFirst,
    15: state_resolver_js_1.isSortedAfterLast,
    16: state_resolver_js_1.wasMatching,
    17: state_resolver_js_1.doesMatchNow
};
function resolveState(stateName, input) {
    const fn = exports.stateResolveFunctions[stateName];
    if (!fn) {
        throw new Error('resolveState() has no function for ' + stateName);
    }
    return fn(input);
}
exports.resolveState = resolveState;
function getStateSet(input) {
    let set = '';
    for (let i = 0; i < exports.orderedStateList.length; i++) {
        const name = exports.orderedStateList[i];
        const value = resolveState(name, input);
        const add = value ? '1' : '0';
        set += add;
    }
    return set;
}
exports.getStateSet = getStateSet;
function logStateSet(stateSet) {
    exports.orderedStateList.forEach((state, index) => {
        console.log('state: ' + state + ' : ' + stateSet[index]);
    });
}
exports.logStateSet = logStateSet;
//# sourceMappingURL=index.js.map