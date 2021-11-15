import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '14a2b0c/d,e+f5g1h.i4j*k-l)m(n6omn5pnm5qbf3rcf3saf3tbn3ucn3vmo3wno3xmp3ykn3zgd2{fq2|ky2}kn2~nt2{h7¡fh7¢nm7£{n7¤sf7¥~h7¦nx7§sn7¨~n7©mn7ªng7«fn7¬il7­in7®nh7¯¤8°rk8±f¡8²fk8³¢k8´§£8µu|8¶gd8·n}8¸¤¥8¹rn8ºf®8»fn8¼¦v8½§¨8¾un8¿©m8Àªn8Á«n8Âwm8Ãxv8Ä¬j8Å­j8Æ®m8Çkm8Ènm8Émo-Êmn-Ë¯´-Ì°µ-ÍÄn-Î±«-Ï²·-ÐÆ¼-Ñ¸½-Ò¹¾-Óm¿-ÔÆn-ÕnÀ-ÖºÁ-×»n-ØmÂ-ÙÇÃ-ÚmÈ-ÛÇn-ÜÄÅ-ÝÆÈ-ÞÇÈ-ßln-àÐÙ,áÒy,âÓÚ,ãÔÛ,ä×n,åÝÞ,æ¶Ë:çeÌ:èÓÍ:é¶Î:êeÏ:ëe³:ìØà:ínÑ:îná:ïâã:ðÕÖ:ñnä:òmÜ:ómß:ômå:õme9ömÉ9÷òë9øóm9ùôì9úõÊ/ûöÊ/ü÷è/ýæé/þçê/ÿøó/Āùï/āíð/Ăîñ/ăze1Ąýþ1ąāĂ1Ćúû0ćăn0ĈüĀ0ĉĄą0Ċòô0ċĆć4ČĈĉ4čċm.ĎČÿ.ďĊó.Đďč*ĐĎ)';

let simpleBdd: SimpleBdd | undefined;
export function getSimpleBdd() {
    if (!simpleBdd) {
        simpleBdd = minimalStringToSimpleBdd(minimalBddString);
    }
    return simpleBdd;
}

export const resolveInput = (input: StateResolveFunctionInput<any>) => {
    return resolveWithSimpleBdd(
        getSimpleBdd(),
        stateResolveFunctionByIndex,
        input
    );
};
