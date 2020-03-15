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

export const minimalBddString = '11a2b0c3d)e*f/g.h-i+j4k(lbj1mkj1nmj3ojk3pkj3qij3rnp,sjo,tlh,ujk,vch,wjh,xmk,yko,zgh,{sj/|ej/}kj/~aj)u{)¡e|)¢k})£~j+¤jx7¥jk7¦jl7§r7¨~n7©jy7ªwt7«¡h7¬¢j7­}i7®}j7¯¢i7°¢q7±¤j4²§j4³©j4´«e4µ¬k4¶­k4·®k4¸¯k4¹°k4ºe´-»£¨-¼±²-½d¥-¾z³-¿cj-Àvj-Ákµ-Âk¶-Ãk·-Äk¸-Åk¹-ÆÄÂ*ÇÁÃ*Èºc2É»¦2Ê¼ª2Ë½¿2Ì¾À2ÍÆf2ÎÇj2ÏÁj2ÐÄf2ÑÅj2ÒÈÏ0ÓÉÊ0ÔËÌ0ÕÍÎ0ÖkÏ0×ÐÑ0ØÓÒ6ÙÕÖ6ÚØÔ5ÛÙ×5ÜÚ½.ÝÛk.ÝÜ8';
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
