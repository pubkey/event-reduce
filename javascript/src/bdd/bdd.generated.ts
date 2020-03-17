import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    ResolverFunctions,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';
import { StateResolveFunctionInput } from '../types';
import {
    isInsert,
    isUpdate,
    isDelete,
    hasLimit,
    isFindOne,
    hasSkip,
    wasResultsEmpty,
    previousUnknown,
    wasLimitReached,
    sortParamsChanged,
    wasInResult,
    wasSortedBeforeFirst,
    wasSortedAfterLast,
    isSortedBeforeFirst,
    isSortedAfterLast,
    wasMatching,
    doesMatchNow
} from '../states/state-resolver';

export const minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4lbh,mdh,neh,ofk-pgk-qdk-rjk-smk-tnk-uik-vkj4wjt4xbd1yjv1zlm1{kv1|jw1}fo/~gp/jr/¡v7¢}k7£~h7¤a7¥dx7¦y7§{7¨t|7©mz7ªuj7«¤j.¬¢ª.­¬£6®¥d6¯k¦6°©k6±«¡0²­¯0³¤§0´ª¨0µ®°0¶ck0·qs0¸j±*¹¸¶2º²µ2»³¶2¼´·2½¹»5¾º¼5½¾8';
export const stateResolvers: ResolverFunctions<StateResolveFunctionInput<any>> = {
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
    16: doesMatchNow,
} as any;

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolvers,
    input
);
