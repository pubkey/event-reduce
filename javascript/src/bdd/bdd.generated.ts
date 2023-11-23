import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const minimalBddString = '14a,b1c+d2e5f0g/h.i4j*k-l)m(n6oah9pce9qnd9rnh9sne9tcm9ube9vbn9waf9xae9yan9zcg9{ck9|bd9}mf9~cn9nf9¡ng9¢nm9£nk9¤mh9¥mi9¦mj9§mk9¨ml9©mn9ªmc8«©n8¬¥n8­¦{8®©t8¯mf8°mg8±m~8²¤¢8³©¢8´mn8µ§m8¶©m8·eu7¸~{7¹p{7º«m7»sn7¼¥m7½m¦7¾¬­7¿ue7À~k7Á¯m7Â°±7Ãde7Ä¥¦7Å©m7Æ·v6Çxo6ÈÅm6Éº¤6Ê»s6Ënr6Ì¼m6Í½m6Î¾®6Ï¿v6Ðxy6ÑÁn6ÒÂ²6ÓÃn6Ôm´6Õ´µ6ÖÄ¨6×Å¤6ØÄ©6ÙÅ©6Úm§6Ûm©6ÜÌØ5ÝÌÖ5Þ©m5ßÈÉ5à¥¦5áÌÍ5â}m5ã}Ñ5ämª4åm´4æÜÎ4çà¨4èÝÖ4éÞ¤4êß×4ëà®4ìáÎ4íâ³4îãÒ4ïm§4ðm³4ñÔÕ4òmb3ómn3ôäb3õån3öæÆ3÷ç|3øèu3ùéq3úêÊ3ûë|3üìÏ3ýí|3þîÓ3ÿûö2Āz¸2ā÷ø2ĂwÇ2ăz¹2Ąùú2ąË2Ć¡»2ćûü2ĈwÐ2ĉzÀ2Ċ{~2ċýþ2Čn2č¡n2ĎïÚ2ďðñ2Đ£n2đòa1Ēón1ēôa1Ĕõn1ĕÿĈ1ĖĀĊ1ėāĂ1Ęă{1ęĄą1ĚćĈ1ěĉĊ1ĜċČ1ĝđc0ĞĒn0ğēc0ĠĔn0ġmn0Ģån0ģĕĖ0ĤėĘ0ĥęĆ0ĦĚě0ħĜč0ĨĎĐ0ĩďĐ0ĪĝĞ/īğĠ/ĬĤĥ/ĭĦħ/ĮÖ×/įØÙ/İĝm.ığm.ĲĪm.ĳīm.Ĵġm.ĵĢm.ĶĤ¨.ķģ¶.ĸĬ¨.Ĺĭ¶.ĺĨ¨.Ļĩ¶.ļÖ¨.ĽØ©.ľĮ¨.Ŀį©.ŀÚ¨.ŁÛ©.łİı-ŃĲĳ-ńĴĵ-ŅĶķ-ņĸĹ-ŇĺĻ-ňļĽ-ŉľĿ-ŊŀŁ-ŋŃń,ŌņŇ,ōŉŊ,Ŏłŋ+ŏŅŌ+Őňō+őŎŏ)őŐ(';

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
