import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '14a2b0c/d,e+f5g1h.i4j*k-l)m(n6ocf3pbf3qaf3rbn3scn3tkn3ueo:vno:wdh:xef:yek:znh:{em:|gq:}dp:~es:et:¡nq:¢nr:£ns:¤gf:¥df:¦dn:§en:¨nf:©gn:ªnm:«nt:¬mh:­mi:®mj:¯mk:°ml:±mn:²gn0³dn0´en0µuv0¶wz0·x¨0¸{ª0¹|¡0º©n0»}¢0¼~£0½¤¨0¾fn0¿¥n0À¦n0Á§n0Âkn0Ã°¬0Ä­±0Å®m0Æ­m6Çm®6ÈÄm6ÉmÅ6Ême9Ëm´9Ì±{9Í­n9Î®k9Ïm¬9ÐÈn9ÑÉm9Ò±¸9ÓÄn9ÔÅÂ9Õm¯9Ö±ª9×m±9Ømn9Ù±m9Ú|¤7Û}w7Ü¥w7ÝÆm7ÞÍÌ7ß|©7à}¦7á¤©7â¥¦7ãÐÏ7ä¹½7å»¶7æ¿¶7çÐ×7èÓÒ7é¹º7ê»À7ë±n7ì½©7í¿À7î­°7ï­±7ðÄÃ7ñÄ±7òmn/óÝî/ôÇ®/õÚ¤/öÛÜ/÷Ýë/øÇ±/ùßá/úàâ/ûãð/üÑÅ/ýä½/þåæ/ÿçë/ĀÑ±/āéì/Ăêí/ăÕ¯/Ąm±/ą×n/ĆÙ±/ćòÊ5ĈòË5ĉòØ5Ċóî5ċô®5Čxu5č÷Þ5ĎøÎ5ď§~5Đûð5đüÅ5Ē·µ5ēÿè5ĔĀÔ5ĕÁ¼5Ė§5ėă¯5ĘĄØ5ęąÖ5Ěn«5ěmć-ĜmĈ-ĝmĉ-ĞĊč-ğċĎ-Ġõù-ġöú-ĢČď-ģĐē-ĤđĔ-ĥýā-ĦþĂ-ħĒĕ-ĨyĖ-ĩmĘ-Īėę-ī°Ć-Ĭîï-ĭðñ-Į¯±-į°±-İĞğ8ıĠf8ĲĢk8ĳģĤ8Ĵĥ¾8ĵħÂ8ĶĪĩ8ķĬ®8ĸĭÅ8ĹĮm8ĺgd2Ļ²³2ļ´e2Ľıġ2ľĲĨ2ĿĴĦ2ŀĵĨ2Łĺe1łĻļ1ŃĽľ1ńĿŀ1ŅěĜ+ņŁł+Ňİĳ+ňŃń+ŉķĸ+ŊŅņ4ŋĝn4ŌŇň4ōĶĚ4ŎŊŉ(ŏmį(ŐŋĹ(őŎŌ)Œŏī)œŐō)Ŕőœ,ŔŒ.';

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
