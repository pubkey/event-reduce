import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '14a,b1c+d5e0f/g2h.i4j*k-l)m(n6ocm:pah:qcf:rbd:sae:tnh:unf:vnd:wad:xme:yan:zcd:{bg:|ck:}nk:~mj:mh:¡mi:¢mk:£ml:¤mn:¥mc9¦mo9§¤m9¨m¢9©rd8ªvn8«zk8¬xm8­zn8®nk8¯fk8°¡~8±¤m8²¡j8³m¤7´¡m7µ~m7¶sp7·xm7¸m7¹©r7ºyt7»¬7¼yh7½dn7¾®m7¿eh7Àm¨7Á°¤7Â°£7Ã±7Ä²¤7Åm¢7Æ¡~6Ç´µ6Èxm6É·¸6Êm¥5Ëmc5Ìm¦5ÍÆ£5ÎÇÂ5ÏÈ5ÐÉ»5Ñjm5Òm¢5ÓÀÅ5ÔÊb4Õnb4Ömb4×Ëb4Øcb4ÙÌg4Ú³g4ÛÍ{4ÜÎ¹4ÝÏ{4ÞÐ¹4ßÂd4à»d4áÑ{4â¾½4ã¾d4äÙá3åes3ækc3çÛÜ3ès¶3éq«3êÝÞ3ësº3ìuª3íáâ3îf®3ï|n3ðÒÓ3ñ}n3òÔa2óÕa2ôÖa2õÖn2ö×a2÷Øa2øäå2ùfæ2úÚs2ûf|2üçè2ýé|2þêë2ÿßw2Ā«|2āà¼2Ăíe2ăîï2Ąã¿2ą¯k2Ćòc1ćóc1Ĉôc1ĉõn1Ċöc1ċ÷c1Čmn1čøù1Ďúû1ďüý1Đþì1đÿĀ1Ēā­1ēĂă1ĔĄą1ĕðñ1ĖÅn1ėĈĉ0ĘďĐ0ęđĒ0Ěēm0ěĔg0ĜÂÃ0ĝĆć/ĞĊċ/ğďđ/ĠčĎ/ġ§¤/ĢĘę/ģĚě/ĤĕĖ/ĥĈm.Ħĝm.ħėm.ĨĞm.ĩČm.Īğ£.īĠġ.ĬĢ£.ĭģm.ĮĤ£.įÂ£.İÁ¤.ıĜ£.ĲÄ¤.ĳÅ£.ĴĥĦ-ĵħĨ-Ķĩm-ķĪī-ĸĬĭ-ĹĮm-ĺįİ-ĻıĲ-ļĳ¤-ĽĵĶ,ľĸĹ,ĿĻļ,ŀĴĽ+Łķľ+łĺĿ+ŃŀŁ)Ńł(';

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
