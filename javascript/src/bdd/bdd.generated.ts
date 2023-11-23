import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const minimalBddString = '14a2b5c)d4e/f*g+h-i.j1k6l0m(n,omk9pnl9qja9rjb9smf9tmc9uml9vmd9wmh9xmi9yni9zmw8{rb7|bk7}bh7~eh7vs7¡um7¢fk6£mz6¤mx6¥ly6¦sm6§~m6¨mw6©t6ª¡i6«lm5¬ds5­l¤5®d¦5¯mw4°¬t4±«i4²£¨4³­ª4´®©4µ°q3¶±a3·³b3¸´{3¹mj3ºhk2»e|2¼e}2½¯²2¾µ¸2¿¶·2Àpk2Áp¥2Âm§2Ã¼h1Ä¾Á1Å¿À1ÆÂl1Çhk1È¹k1É¹n1Êgn1Ë½º0ÌÄÃ0ÍÅ»0ÎÆÇ0Ïmk0ÐÈk0ÑÉg0ÒÊg0ÓÌÍ/Ô©ª/ÕÑÐ/Ö©t.×¨t.ØÔt.Ù¢o.ÚÌt.ÛËt.ÜÓt.ÝÎm.ÞÑm.ßÏm.àÕm.áÒm.âÖm-ã×m-äØÙ-åÚm-æÛm-çÜÝ-èÞm-éßm-êàá-ëäã,ìçæ,íêé,îâë+ïåì+ðèí+ñðï)ñî(';

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
