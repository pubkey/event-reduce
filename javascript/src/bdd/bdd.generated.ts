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

export const minimalBddString = '11a2b0c3d)e*f/g.h-i+j4k(lkj4mjk4nik4oja-pgl-qhj-rej-sdj-tcj-ugj-vkm-wkn-xkj-yjk-zae6{oe6|je6}jv6~jk6hj6¡jc6¢jx6£jr6¤lv6¥yk6¦xk6§jh6¨zs5©{s5ªjk5«|s5¬¥q5­}p5®¤q5¯~u5°q5±¡t5²jt5³¢q5´¢u5µ£s5¶¦x5·xw5¸§k5¹¨©+ºjµ/»j´/¼j³/½k¶/¾kx/¿|s3À~u3Á­ª3Â®ª3Ãº«3Ä»¯3Å~q3Æ¼¬3Ç·j3Èvj3É½k3Ê¾k3Ë¦j3Ìbh,Í¯¬,ÎÀÅ,ÏÁÂ,ÐÄÆ,Ñ²°,Òk¹8Ófb8ÔjÌ8ÕkÍ8Ök¿8×kÎ8ØÇÏ8Ùi¸8ÚÉÃ8ÛÊÐ8Üks8Ýf±8ÞjÑ8ßËk8àik8áÖà7â×ß7ãÛØ7äÚÙ7åÜk7æÊi7çÊÈ7èÒÕ0éÓÔ0êáâ0ëÝÞ0ìäã0ífj0îæç0ïÜå)ðèì)ñíé)òîê)ókå)ôðï.õòó.öõô1÷ñë1ö÷2';
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
