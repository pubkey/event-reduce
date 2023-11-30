import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const minimalBddString = '14a1b,c+d2e5f0g/h.i4j*k-l)m(n6oin8pjk8qmc8rmn8snm8tio4umq4vjp4wmr4xns4yeh6zmq6{is6|tx6}mr6~ns6nx6¡en6¢il6£nh6¤in6¥y£/¦z}/§{~/¨|/©uw/ªvw/«an/¬en/­bn/®¡n/¯cn/°kn/±¢£/²¤n/³jm/´yk0µac0¶ek0·bc0¸¥k0¹dg0º¡n0»«¯0¼¬°0½­c0¾fk0¿®n0À¸n,Á¦r,Â§s,Ã¨s,Ä©r,Åªr,Æ½n,Ç¾k,È¿n,É±k,Ê²n,Ë³m,Ì¾´2Ízu2Î{|2Ï¾º2Ð¹e2ÑÇÀ2ÒÁÄ2ÓÂÃ2Ô¹º2ÕÇÈ2ÖÍm5×Î¤5Øum5Ùvj5ÚÒm5ÛÓÊ5ÜÄm5ÝÅË5ÞÌÑ+ßÖÚ+à×Û+áØÜ+âÙÝ+ãµ»+ä¶¼+å·Æ+æÏÕ+ç¢É+è¤Ê+éjË+êçÐ3ëmã3ìéä3íßã3îàÔ3ïáã3ðâä3ñêì7òíï7óîð7ôçé7õèé7öïå1÷ëå1øñÞ1ùòå1úóæ1û÷ö-ü÷ù-ýøú-þls-ÿôõ-Āln-āmü)Ăÿý)ăĀþ)ĄāĂ9ąmă9ĆĄû*ćąm*Ćć.';

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
