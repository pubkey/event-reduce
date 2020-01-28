import {
    StateName,
    StateResolveFunction,
    QueryParams,
    ChangeEvent,
    ResultKeyDocumentMap,
    StateSet,
    StateResolveFunctionInput
} from "../types";

import {
    hasLimit,
    hasSkip,
    isDelete,
    isInsert,
    isUpdate,
    previousStateUnknown,
    wasLimitReached,
    sortParamsChanged,
    wasInResult,
    wasSortedBeforeFirst,
    wasSortedAfterLast,
    isSortedBeforeFirst,
    isSortedAfterLast,
    wasMatching,
    doesMatchNow
} from './state-resolver';

/**
 * all states orders by performance-cost
 * cheapest first
 * TODO run tests on which is really the fastest
 */
export const orderedStateList: StateName[] = [
    'hasLimit',
    'hasSkip',
    'isDelete',
    'isInsert',
    'isUpdate',
    'previousStateUnknown',
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


export function resolveState<DocType>(
    stateName: StateName,
    input: StateResolveFunctionInput<DocType>
): boolean {
    const fn: StateResolveFunction<DocType> = stateResolveFunctions[stateName];
    if (!fn) {
        throw new Error('resolveState() has no function for ' + stateName);
    }
    return fn(input);
}

export const stateResolveFunctions: {
    [k: string]: StateResolveFunction<any>
} = {
    hasLimit,
    hasSkip,
    isDelete,
    isInsert,
    isUpdate,
    previousStateUnknown,
    wasLimitReached,
    sortParamsChanged,
    wasInResult,
    wasSortedBeforeFirst,
    wasSortedAfterLast,
    isSortedBeforeFirst,
    isSortedAfterLast,
    wasMatching,
    doesMatchNow
};

export function getStateSet<DocType>(
    input: StateResolveFunctionInput<DocType>
): StateSet {
    let set: StateSet = '';
    for (let i = 0; i < orderedStateList.length; i++) {
        const name: StateName = orderedStateList[i];
        const value = resolveState(name, input);
        const add = value ? '1' : '0';
        set += add;
    }
    return set;
}