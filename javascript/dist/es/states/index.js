import { hasLimit, isFindOne, hasSkip, wasResultsEmpty, isDelete, isInsert, isUpdate, previousUnknown, wasLimitReached, sortParamsChanged, wasInResult, wasSortedBeforeFirst, wasSortedAfterLast, isSortedBeforeFirst, isSortedAfterLast, wasMatching, doesMatchNow } from './state-resolver';
/**
 * all states ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export var orderedStateList = [
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
export var stateResolveFunctions = {
    isInsert: isInsert,
    isUpdate: isUpdate,
    isDelete: isDelete,
    hasLimit: hasLimit,
    isFindOne: isFindOne,
    hasSkip: hasSkip,
    wasResultsEmpty: wasResultsEmpty,
    previousUnknown: previousUnknown,
    wasLimitReached: wasLimitReached,
    sortParamsChanged: sortParamsChanged,
    wasInResult: wasInResult,
    wasSortedBeforeFirst: wasSortedBeforeFirst,
    wasSortedAfterLast: wasSortedAfterLast,
    isSortedBeforeFirst: isSortedBeforeFirst,
    isSortedAfterLast: isSortedAfterLast,
    wasMatching: wasMatching,
    doesMatchNow: doesMatchNow
};
export var stateResolveFunctionByIndex = {
    0: isInsert,
    1: isUpdate,
    2: isDelete,
    3: hasLimit,
    4: isFindOne,
    5: hasSkip,
    6: wasResultsEmpty,
    7: previousUnknown,
    8: wasLimitReached,
    9: sortParamsChanged,
    10: wasInResult,
    11: wasSortedBeforeFirst,
    12: wasSortedAfterLast,
    13: isSortedBeforeFirst,
    14: isSortedAfterLast,
    15: wasMatching,
    16: doesMatchNow
};
export function resolveState(stateName, input) {
    var fn = stateResolveFunctions[stateName];
    if (!fn) {
        throw new Error('resolveState() has no function for ' + stateName);
    }
    return fn(input);
}
export function getStateSet(input) {
    var set = '';
    for (var i = 0; i < orderedStateList.length; i++) {
        var name_1 = orderedStateList[i];
        var value = resolveState(name_1, input);
        var add = value ? '1' : '0';
        set += add;
    }
    return set;
}
export function logStateSet(stateSet) {
    orderedStateList.forEach(function (state, index) {
        console.log('state: ' + state + ' : ' + stateSet[index]);
    });
}
//# sourceMappingURL=index.js.map