import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const minimalBddString = '14a1b,c2d+e5f0g/h.i4j*k-l)m(n6obh9pde9qnh9rac9sdm9tae9uan9vbf9wbe9xbn9ydg9zdk9{nc9|mf9}dn9~ne9nf9¡ng9¢nm9£nk9¤mh9¥mi9¦mj9§mk9¨ml9©mn9ªmd8«¥}8¬¦z8­©s8®©n8¯©}8°mn8±©¢8²©m8³pz7´«¬7µ}z7¶|m7·®m7¸¯°7¹~n7º¥¦7»©m7¼wo6½¹~6¾nq6¿´­6Àtu6Áwx6Â¶¤6Ã·©6Ä¸±6Å¹n6Æ°±6Çº¨6È»¤6Éº©6Ê»©6Ëm§6Ìm©6Í¥¦5Î©m5ÏÂÃ5Ðmª4Ñm°4ÒÍ¨4ÓÎ¤4ÔÍ­4ÕÉ¿4ÖÎ±4×ÏÄ4Øm§4Ùm±4ÚÌÆ4Ûma3Ümn3ÝÐa3ÞÑn3ßÒr3àÇt3áÓ{3âÈ½3ãÔr3äÕÀ3åÖ{3æ×Å3çßà2èv¼2éy³2êáâ2ë¾2ì¡¹2íãä2îvÁ2ïyµ2ðz}2ñåæ2òn2ó¡n2ôØË2õÙÚ2ö£n2÷Ûb1øÜn1ùÝb1úÞn1ûçè1üéz1ýêë1þíî1ÿïð1Āñò1ā÷d0Ăøn0ăùd0Ąún0ąmn0ĆÑn0ćûü0Ĉýì0ĉþÿ0ĊĀó0ċôö0Čõö0čāĂ/ĎăĄ/ďćĈ/ĐĉĊ/đÇÈ/ĒÉÊ/ēām.Ĕăm.ĕčm.ĖĎm.ėąm.ĘĆm.ęć¨.Ěĉ².ěď¨.ĜĐ².ĝċ¨.ĞČ².ğÇ¨.ĠÉ©.ġđ¨.ĢĒ©.ģË¨.ĤÌ©.ĥēĔ-ĦĕĖ-ħėĘ-ĨęĚ-ĩěĜ-ĪĝĞ-īğĠ-ĬġĢ-ĭģĤ-ĮĦħ,įĩĪ,İĬĭ,ıĥĮ+ĲĨį+ĳīİ+ĴıĲ)Ĵĳ(';

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
