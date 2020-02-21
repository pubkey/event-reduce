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

export const minimalBddString = '11a2b0c3d)e*f/g.h-i+j4k(lbh,mjh,nch,ojk,pgh,qkj,rjo-snj-tcj-upj-vej-wdj-xpq-yki-zkj-{aw5|ou5}mk5~ru5ms5¡jt5¢ju5£jw5¤ox5¥zy5¦jk5§ju3¨jw3©¤}3ªj~3«j£3¬¥j3­zj3®l1¯b¡1°§ª1±¨«1²k©1³k¦1´­¬1µ²¢4¶­k4·jk4¸´k4¹{|0º¯®0»ek0¼±°0½³µ0¾h¶0¿i¸0À¡0Áfj0Âcj0Ã£¢0Ävz0Åkz0Æ¹»6ÇºÂ6È¼»6É½¾6Ê¿·6ËÀÂ6ÌÁj6ÍÃÄ6ÎzÅ6ÏÈÆ(Ðwk7ÑÏÉ7ÒkÊ7ÓkÐ8ÔÒÑ8ÕÌÇ8ÖÌË8×ÎÍ8Økw8ÙÔÓ.Ú×Ø.ÛÙÕ2ÜÚÖ2ÛÜ/';
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
