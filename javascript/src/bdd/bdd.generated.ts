import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const minimalBddString = '14a2b5c0d4e6f,g)h-i.j1k+l*m/n(one9peh9qem9rkm9seb9tkb9ufc9vng9wfe9xnl9yke9znc9{nd9|kh9}nh9~fi9ni9¡n}8¢sy7£t|7¤{x7¥mh7¦{n7§zn7¨n¡6©n6ªu~6«n}6¬¤v6­xn6®¥n6¯le6°§6±{x5²zn5³§©5´¦­5µn}4¶±v4·¨«4¸²4¹³°4º´¬4»¶a3¼¸a3½¹b3¾ºb3¿nj3Àpe2Áµ·2Âuw2Ãq¢2Äuª2År£2Æ»¾2Ç¼½2Èn®2ÉÅh1ÊÇÂ1ËÆÄ1Ì¿e1Í¿f1Îkf1ÏÁÀ0ÐËÉ0ÑÊÃ0ÒÈh0Óne0ÔÌe0ÕÍk0ÖÎk0×ÐÑ/Ø¬°/ÙÕÔ/Ú¬v.Û«v.ÜØv.Ý¯o.ÞÐv.ßÏv.à×v.áÒn.âÕn.ãÓn.äÙn.åÖn.æÚn-çÛn-èÜÝ-éÞn-êßn-ëàá-ìân-íãn-îäå-ïèç,ðëê,ñîí,òæï+óéð+ôìñ+õôó)õò(';

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
