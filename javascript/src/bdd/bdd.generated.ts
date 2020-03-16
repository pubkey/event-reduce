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

export const minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4lfk-mgk-ndk-ojk-pek-qhk-rik-sbd1tsh,udh,vnq,wpq,xst0yfk0zgj0{lk0|mo0}ck0~du0dk0¡nv0¢ak0£hk0¤rw0¥x6¦yz6§{|6¨~6©k£6ªkj6«¦z4¬«¤5­¦¤5®¥¡5¯jo5°§¤5±¨¡5²©j5³ªw5´¯o*µj´/¶¬°/·µj3¸j¢3¹¶­3º³²3»·}2¼¸}2½¹±2¾º®2¿»¼7À½¾7Árj7Â¿À8ÃjÁ8ÂÃ.';
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
