import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '12a/b3c,d+e0f.g2h*i-j)k(l4mde:nle:ocb:pdb:qcf:rlb:sdk:tdi:ulk:vab:wce:xcl:ydl:zli:{kg:|kf:}kh:~ki:kj:¡kl:¢kd9£ls9¤k|9¥ks9¦¡s9§¡k9¨k~9©pt8ªry8«pi8¬vl8­rl8®l¡8¯vb8°li8±lk8²ei8³{}8´¡k8µg}8¶°£7·bl7¸eq7¹°l7ºex7»{k7¼}k7½¡k7¾±¤7¿bv7À¯b7Áoq7Âxq7Ã°¦7Ä®u7Åwx7Æ±k7Çk¨7Èlk7É³7Ê´|7Ëµ¡7Ìkl7Ík~7Îk¡7Ï{}6Ð»¼6Ñ¡k6Ò½¾6Ók¢5Ô}¦5Õk¶5ÖÏ5×ÐÉ5ØÑ|5ÙÒÊ5Úk¥5ÛkÃ5Ük~5ÝÇÍ5Þda4ßkl4àka4áÓa4âla4ãÔe4äÕ·4å¹b4æÖe4ç×¿4èØe4éÙ¿4êÉÀ4ëÊ¬4ìÚe4íÛb4îke4ïÄ¯4ðãä3ñw¸3òil3ók§3ôæç3õwÁ3öm©3÷èé3øwÂ3ùnª3úìí3ûeÅ3üe°3ýîb3þÜÝ3ÿzl3ĀÞc2āßl2Ăàc2ăàl2Ąác2ąâc2Ćðñ2ćüò2Ĉåº2ĉ°t2Ċôõ2ċöt2Č÷ø2čêÁ2Ď«t2ďëÂ2Đúû2đüt2ĒïÅ2ē°y2ĔÆe2ĕĀd1Ėāl1ėĂd1Ęăl1ęĄd1Ěąd1ěkl1ĜĆć1ĝĈĉ1ĞĊċ1ğČù1ĠčĎ1ġď­1ĢĐđ1ģýe1ĤĒē1ĥĔ²1Ħþÿ1ħÍl1ĨÈi1ĩėĖ0ĪėĘ0īęl0ĬĞğ0ĭĠġ0ĮĢģ0įĤĥ0İÉÊ0ıËÌ0Ĳęĕ/ĳĩĪ/ĴīĚ/ĵĞĠ/ĶĜĝ/ķók/ĸĬĭ/ĹĮį/ĺ§¡/ĻĦħ/ļkĨ/Ľėk.ľĲk.Ŀĳk.ŀĴk.Łěk.łlk.Ńĵ.ńĶķ.Ņĸ.ņĹĺ.ŇĻ.ňļk.ŉÉ.ŊË¡.ŋİ.Ōı¡.ōÍ.ŎÎ¡.ŏĽľ-ŐĿŀ-őŁł-ŒŃń-œŅņ-ŔŇň-ŕŉŊ-ŖŋŌ-ŗōŎ-ŘŐő,řœŔ,ŚŖŗ,śŏŘ+ŜŒř+ŝŕŚ+ŞśŜ)Şŝ(';

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
