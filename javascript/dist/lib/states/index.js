import { hasLimit, isFindOne, hasSkip, wasResultsEmpty, isDelete, isInsert, isUpdate, previousUnknown, wasLimitReached, sortParamsChanged, wasInResult, wasFirst, wasLast, wasSortedBeforeFirst, wasSortedAfterLast, isSortedBeforeFirst, isSortedAfterLast, wasMatching, doesMatchNow } from './state-resolver';
export * from './state-resolver';
/**
 * all states ordered by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export const orderedStateList = [
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
export const stateResolveFunctions = {
    isInsert,
    isUpdate,
    isDelete,
    hasLimit,
    isFindOne,
    hasSkip,
    wasResultsEmpty,
    previousUnknown,
    wasLimitReached,
    wasFirst,
    wasLast,
    sortParamsChanged,
    wasInResult,
    wasSortedBeforeFirst,
    wasSortedAfterLast,
    isSortedBeforeFirst,
    isSortedAfterLast,
    wasMatching,
    doesMatchNow
};
export const stateResolveFunctionByIndex = {
    0: isInsert,
    1: isUpdate,
    2: isDelete,
    3: hasLimit,
    4: isFindOne,
    5: hasSkip,
    6: wasResultsEmpty,
    7: previousUnknown,
    8: wasLimitReached,
    9: wasFirst,
    10: wasLast,
    11: sortParamsChanged,
    12: wasInResult,
    13: wasSortedBeforeFirst,
    14: wasSortedAfterLast,
    15: isSortedBeforeFirst,
    16: isSortedAfterLast,
    17: wasMatching,
    18: doesMatchNow
};
export function resolveState(stateName, input) {
    const fn = stateResolveFunctions[stateName];
    if (!fn) {
        throw new Error('resolveState() has no function for ' + stateName);
    }
    return fn(input);
}
export function getStateSet(input) {
    let set = '';
    for (let i = 0; i < orderedStateList.length; i++) {
        const name = orderedStateList[i];
        const value = resolveState(name, input);
        const add = value ? '1' : '0';
        set += add;
    }
    return set;
}
export function logStateSet(stateSet) {
    orderedStateList.forEach((state, index) => {
        console.log('state: ' + state + ' : ' + stateSet[index]);
    });
}
//# sourceMappingURL=index.js.map