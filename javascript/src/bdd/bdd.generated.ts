import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '14a0b2c4d/e,f*g5h1i+j6k-l.m)n(onj:pjk:qik:rhg:sjd:tid:ujg:vnf:wna:xnc:yig:znk:{nl:|nm:}nz9~uj8yk8¡xv8¢jk8£wn8¤yj8¥bg8¦cf8§dk8¨n}7©n{7ªgr7«fj7¬¡|7­£{7®an7¯cn7°nz7±jl7²¥g7³¦|7´§n7µnl7¶an6·®©6¸cv6¹¯v6ºnz5»¨°5¼¶{5½·­5¾¸|5¿¹¬5À¼b4Á½g4Â¿ª4Ã¾b4Ä³²4Åµ¥4Ænh4Çpj3Èqk3Éº»3Êa±3ËÀÁ3ÌÃÂ3Ís~3Ît3Ïn´3ÐÎÈ2ÑËÊ2ÒÌa2Ó¢k2ÔÆe2Õyk2ÖÅ±2×Äa2ØÆj2Ùhe2Úie2ÛÉÇ1ÜÒÐ1ÝÑÍ1ÞÏÓ1ßnj1àØj1áÔi1â°j1ã×Õ1äÖ¤1åni1æÙi1çÜÝ0è¬­0éáà0êãä0ëæØ0ìÜã/íÛâ/îçê/ï|n/ðÞ´/ñáæ/òßå/óéë/ô¬|.õ°|.öè|.÷«o.øìï.ùíï.úîï.ûðn.üñn.ýòn.þón.ÿÚn.Āôn-āõn-Ăö÷-ăøn-Ąùn-ąúû-Ćün-ćýn-Ĉþÿ-ĉĂā,ĊąĄ,ċĈć,ČĀĉ+čăĊ+ĎĆċ+ďĎč)ďČ(';

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
