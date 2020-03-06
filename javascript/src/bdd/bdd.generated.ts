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

export const minimalBddString = '11a2b0c3d)e*f/g.h-i+j4k(lkj3mjk3nij3ojm1pbj1qkj1rkm1skl1tjn1uja(vok(wuj/xvj/yej/zkj/{ey-|jw-}dj-~jx-gj-¡hj-¢cj-£ks-¤kz-¥kj-¦hr-§gk-¨kt-©{h7ª|q7«jp7¬jq7­}k7®¡¦7¯§7°~£7±¤j7²¤i7³¤¥7´¤¨7µ«h,¶¬°,·¯®,¸¡,¹¢¡,ºª­5»«¢5¼µ¹5½¶·5¾j¸5¿³´5Àº©6Á»c6Â¼j6Ã½³6Ä¾k6Å²k6Æ¿±6ÇÅ²*ÈÆ³*ÉÀÃ0ÊÁÂ0ËeÄ0Ìfj0ÍÇÈ0ÎÉ­.ÏÍk.ÐÎÊ2ÑÏÌ2ÒÐË4ÓÑk4ÓÒ8';
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
