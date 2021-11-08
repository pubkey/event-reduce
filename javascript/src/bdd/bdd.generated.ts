import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '12a0b2c)d+e.f3g/h-i*j4k,l(mjh:nda:ogf:pja:qdf:rlh:slc:tli:ulj:vlb:wle:xlr9yjl8zpj8{qh8|fj8}ul8~vt8af8¡jh8¢ij7£lx7¤yw7¥fo7¦je7§ul7¨vl7©lr7ª}w7«~s7¬¡l7­vt6®ul6¯§¤6°¨t6±lr5²­s5³®w5´£©5µ¯ª5¶°«5·²a4¸³a4¹µf4º¶¥4»«4¼ª4½lg4¾mj3¿±´3Àa¦3Á·º3Âpz3Ãn{3Ä¸¹3Ål¬3ÆÃh2ÇÄÀ2ÈÁa2É½k2Êdk2Ëfl2Ì¼j2Í»a2Î½j2Ïgk2Ð¿¾1ÑÈÆ1ÒÇÂ1ÓÅj1ÔÎj1ÕÉd1ÖÊd1×©j1ØÍË1ÙÌ|1Úlj1ÛÎd1ÜÏd1ÝÑÒ0Þ«ª0ßÕÔ0àØÙ0áÜÛ0âÑØ/ãÐ×/äÝà/åls/æÓ¬/çÕÜ/èßá/éÖd/ê«s.ë©s.ìÞs.í¢u.îâå.ïãå.ðäå.ñæl.òçl.óÚl.ôèl.õél.öêl-÷ël-øìí-ùîl-úïl-ûðñ-üòl-ýól-þôõ-ÿø÷,Āûú,āþý,Ăöÿ+ăùĀ+Ąüā+ąĄă)ąĂ(';

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolveFunctionByIndex,
    input
);
