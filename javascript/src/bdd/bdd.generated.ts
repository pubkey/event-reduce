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

export const minimalBddString = '11a2b0c3d)e*f/g.h-i+j4k(lkj4mjk4nik4oae6pje6qjc6rhj6slk6tjm6ujh6vkm6wjk6xbh,yws,zlj,{wk,|ch,}jr,~gh,tv,¡kn,¢bx0£u}0¤o{0¥kz0¦p{0§im0¨c|0©pw0ªq}0«d~0¬wj0­u0®fj0¯iw0°ij0±i¡0²­£3³j©3´j¦3µ¥k3¶§°3·±°3¸©³1¹¢ª1ºk²1»©´1¼ky1½kµ1¾¯°1¿°·1À¸¼7Á»º7Âj½7Ã«~7Äjk7Åk¾7Æk¶7Çk¿7ÈÀÁ-ÉÃÂ-Ê¨j-ËdÄ-ÌkÅ-ÍkÆ-Î©j-Ï«j-Ðk¬-Ñdj-Òkj-ÓkÇ-ÔËÑ(ÕÈ¤(ÖÉÏ(×Ìk(ØÓk(ÙÔÑ/ÚÕÎ/Û¹ª/ÜÖÏ/Ý×Ð/ÞÍÒ/ßØÒ/àÝÞ*áÚÜ5âÛÊ5ãàß5äáâ2åã®2æäÙ.çåk.çæ8';
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
