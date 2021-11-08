import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '12a0b2c,d*e3f/g+h4i-j.k)l(mhj7nae7ohl7pbk7qhm5rbp5shj5tbk5uhl,vmi,wqi,xsi,yji,zle4{ya4|pn4}de4~lf4ey6¡el6¢fl6£lz/¤d}/¥w{/¦r|/§l~/¨lf/©e1ª¡h1«ei1¬£h1­¥e1®¦e1¯oh1°lg1±¢h1²mh1³ai1´hg1µcg1¶lh1·fg1¸lu:¹h³:ºg³:»lv:¼lp:½¶©:¾·e:¿lk:Àga:Áld:Âha:Ãl¬:Äl¤:Å°­:Æ°®:Çlx:Èlt:Éh²:Ê¹É3Ëº³3Ìlª3ÍÂ½3ÎÀ¾3ÏlÃ3ÐÁÄ3Ñl¯3ÒÇÅ3ÓÈÆ3ÔËÊ0ÕÁl0Ö«Ì0×¼»0ØÎÍ0ÙÐÏ0ÚÓÒ0Û·±0Üµh0Ý¨§0Þ³É0ßµ´0àl¸+áËÔ+âÁÕ+ã«Ö+ä¼×+åÎØ+æÐÙ+çÓÚ+è·Û+éµÜ+ê¨Ý+ë³Þ+ìµß+í¿l*îàl*ïäê*ðhg*ñïâ8òåã8óçæ8ôðd8õÑi8öoi8÷òá2øñì2ùóë2úõi2ûôc2üèé2ýgc2þîl9ÿù÷9Āøü9āöú9Ăûý9ăí¿)Ąþl)ąĀÿ)ĆĂā)ćăĄ-ĈąĆ-Ĉć.';

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolveFunctionByIndex,
    input
);
