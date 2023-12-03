import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const minimalBddString = '14a1b,c+d2e5f0g/h.i4j*k-l)m(n6obh9pce9qnh9rad9scm9tae9uan9vbf9wbe9xbn9ycg9zck9{cn9|nd9}ne9~nf9ng9¡nm9¢nk9£mh9¤mi9¥mj9¦mk9§ml9¨mn9©£¦,ªmc8«¤{8¬¥z8­¨s8®¨n8¯mn8°¨¡8±¨m8²mª4³£©4´¤«4µ¥¬4¶¨­4·¨®4¸m¯4¹¨°4ºpz7»´µ7¼{z7½·¸7¾}n7¿¤¥7À¨m7Á¤§6Âwo6Ã¤­6Ä»¶6Åtu6Æwx6Ç¨©6ÈÀ³6É¾}6Ênq6Ë¨°6Ì½¹6Í¾n6Î¿§6Ï¿¨6ÐÀ©6ÑÀ¨6Òac0Óbc0Ôtº0ÕÂz0Öry0×Å¼0Øvz0ÙÆ{0ÚÉ¾0ÛÊn0Ü|0ÝÍn0Þ~¢0ß²m5à¸m5áÁ¥5âÃ¥5ãÄÏ5äÇm5åÈÐ5æËm5çÌÑ5èáÎ2éÖÔ2êØÕ2ëâã2ìÖ×2íØÙ2îäå2ïÜÚ2ðÞÛ2ñæç2òÜÝ2óÞn2ôßà/õÒn/öÓn/÷èî/øéï/ùêð/úëñ/ûìò/üíó/ýÎÐ/þÏÑ/ÿmô-Ā÷ú-āøû-Ăùü-ă§±-Ąýþ-ą§¨-Ćõö1ćāĂ1ĈĀÿ*ĉćĆ*Ċăm*ċĈĉ3ČċĊ.čĄą.Čč(';

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
