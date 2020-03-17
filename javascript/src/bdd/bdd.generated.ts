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

export const minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4lbh,meh,ndh,ofg6pkh6qkj6rnk6sok-tdk-uqk-vjk-wmk-xnk-yik-zoy5{qw5|sy5}dt5~jv5uw5¡rx5¢pj5£kj5¤oz1¥yz1¦b}1§q{1¨j{1©w{1ªl¡1«j¢1¬j£1­¤¥3®§©3¯jk3°¨¬3±~v*²j±/³­|/´®/µ²c2¶ac2·²k2¸¯k2¹³}2º«¦2»´¡2¼°ª2½µj.¾¶j.¿¹y.Àºj.Á½¾7Â·¸7Ã¿À7Ä»¼7ÅÁÃ8ÆÂÄ8ÅÆ0';
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
