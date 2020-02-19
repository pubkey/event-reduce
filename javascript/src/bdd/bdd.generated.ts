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

export const minimalBddString = '11a2b0c3d)e*f/g.h-i+j4k(lja7mjk7njl5obj5pjm5qkj5rnj4sqj4tpk4upj4vjk4wkh4xij4ysj3zqj3{vj3|kj3}xk3~jk3rj2¡tj2¢ej2£uj2¤kj2¥e¢1¦gj1§dj1¨zy1©£¡1ªh{1«g|1¬hj1­cj1®|w1¯k¤1°k}1±k~1²¥h0³s0´jo0µj¨0¶¬ª0·¦«0¸§k0¹©®0º¯i0»¯°0¼¯±0½³¸/¾´­/¿µ·/À¹¶/Áh¬/Â¼»/Ãk¸.Äk².Åº½.Æj¾.Çf¾.È¼¿.ÉÂÀ.ÊjÁ.ËÅÃ,ÌËÈ+ÍÃÉ+ÎÄ¼+ÏÇÆ+Ðcj+ÑÌÍ*ÒÎ¼*ÓÏÊ*ÔÐj*ÕÑÓ)ÖÒÔ)ÕÖ';
export const stateResolvers: ResolverFunctions<StateResolveFunctionInput<any>> = {
    15: isInsert,
    16: isUpdate,
    14: isDelete,
    5: hasLimit,
    2: isFindOne,
    9: hasSkip,
    4: wasResultsEmpty,
    10: previousUnknown,
    3: wasLimitReached,
    13: sortParamsChanged,
    1: wasInResult,
    12: wasSortedBeforeFirst,
    11: wasSortedAfterLast,
    7: isSortedBeforeFirst,
    0: isSortedAfterLast,
    8: wasMatching,
    6: doesMatchNow,
} as any;
export const valueMapping: {
    [k: number]: number;
} = {
    "0": 14,
    "1": 10,
    "2": 4,
    "3": 8,
    "4": 6,
    "5": 3,
    "6": 16,
    "7": 13,
    "8": 15,
    "9": 5,
    "10": 7,
    "11": 12,
    "12": 11,
    "13": 9,
    "14": 2,
    "15": 0,
    "16": 1
} as any;

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolvers,
    input
);
