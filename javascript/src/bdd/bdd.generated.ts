import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4lfk/mjk/nkg4omj4pkj4qlf3rng3soj3tpj3ujk3vkj3wqr6xkh6ykt6zku6{dk6|hk6}fg6~kj6{d5¡wk5¢xj5£js5¤yk5¥zv5¦dk5§{k5¨|h5©jt5ªtk5«ju5¬uv5­|k5®}i5¯~e5°}k5±~k5²jh5³jk5´bd1µj¯1¶b1·°¡1¸j¢1¹b¦1ºj£1»±¤1¼j¥1½b§1¾j²1¿h¨1Àj©1Á³ª1Â³«1Ãj¬1Äh­1Å°·)Æjº)Ç±»)ÈjÀ)É³Á)Êsa7Ësu7Ìtu7Íd´7ÎÆa7ÏÅ¸7Ð¦¹7Ñ¯µ7Ò¶7ÓÆÂ7ÔÇ¼7Õ§½7Ö²¾7×¨¿7ØÈÂ7ÙÉÃ7Ú­Ä7Ûkj7ÜÊË0Ý®Ñ0ÞÍÒ0ßÎÓ0àÏÔ0áck0âÐÕ0ãÜÌ,äÝÖ,åák,æÞ×,çßØ,èàÙ,éâÚ,êjã-ëjç-ìäè-íæé-îiÛ-ïëì8ðåí8ñjî8òêå2óïð2ôòj.õóñ.õô*';

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolveFunctionByIndex,
    input
);
