import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const minimalBddString = '14a2b5c1d0e,f/g+h.i4j*k-l)m(n6oeh9pgb9qna9rnh9snb9tca9ued9veb9wgf9xgk9ymd9zgm9{cb9|cn9}nd9~en9nf9¡gn9¢nm9£nk9¤mh9¥mi9¦mj9§mk9¨ml9©mn9ªmg8«¥¡8¬¦x8­¤n8®yn8¯©z8°mn8±©¢8²©m8³px7´sn7µ«¬7¶¡x7·ym7¸nm7¹®°7º{|7»n¡7¼¥¦7½©m7¾vo6¿´s6Ànr6Áµ¯6Â{|6Ãv~6Ä·m6Å¸­6Æ¹¯6Çºn6È~n6Ém°6Ên±6Ë¼¨6Ì½¤6Í¼©6Î½©6Ïm§6Ðm©6Ñ©m5Ò¥¦5ÓËÍ5Ôym5ÕÄÅ5Ömª4×m°4ØÒ¨4ÙÑ¤4ÚÒ¯4ÛÓÁ4ÜÔ±4ÝÕÆ4Þm§4ßm±4àÉÊ4ámc3âmn3ãÖc3ä×n3åØt3æË{3çÙq3èÌ¿3éÚt3êÛÂ3ëÜa3ìÝÇ3íåæ2îu¾2ïw³2ðçè2ñ}À2ò´2óéê2ôuÃ2õw¶2öx¡2÷ëì2ø}È2ù»2úÞÏ2ûßà2ü£n2ýáe1þân1ÿãe1Āän1āíî1Ăïx1ăðñ1Ąóô1ąõö1Ć÷ø1ćýg0Ĉþn0ĉÿg0ĊĀn0ċmn0Č×n0čāĂ0Ďăò0ďĄą0ĐĆù0đúü0Ēûü0ēćĈ/ĔĉĊ/ĕčĎ/ĖďĐ/ėËÌ/ĘÍÎ/ęćm.Ěĉm.ěēm.ĜĔm.ĝċm.ĞČm.ğč¨.Ġď².ġĕ¨.ĢĖ².ģđ¨.ĤĒ².ĥË¨.ĦÍ©.ħė¨.ĨĘ©.ĩÏ¨.ĪÐ©.īęĚ-ĬěĜ-ĭĝĞ-ĮğĠ-įġĢ-İģĤ-ıĥĦ-ĲħĨ-ĳĩĪ-ĴĬĭ,ĵįİ,ĶĲĳ,ķīĴ+ĸĮĵ+ĹıĶ+ĺķĸ)ĺĹ(';

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
