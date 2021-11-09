import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '12a/b3c0d,e+f.g2h*i-j)k(l4mdb:nec:oab:plc:qeb:rei:sdf:tlb:uek:vdc:wdl:xel:yli:zkg:{kf:|kh:}ki:~kj:kl:¡ke9¢u9£k{9¤lu9¥k9¦k}9§qr8¨lk8©tx8ªqi8«tl8¬l8­li8®z|8¯k8°g|8±¨k,²£¦,³¥k,´¯k,µ{},¶l,·al2¸ad2¹­r2ºbv2»bs2¼ªr2½bw2¾«l2¿bc2À­x2Á|k3Â¢¤3Ãvc3Äk¥3Åvm3Æn§3Çk±3Èvw3Ép©3Êk¤3Ëcb3Ìcv3Íc­3Îkb3Ïk³3Ðyl3Ñ­Â7ÒÃd7Ó­l7Ôcd7Õzk7Ö|k7×Ås7Øk7ÙÇ²7ÚËo7ÛÈs7Üº»7Ý½s7Þ­Ê7ßÌw7àÎb7á¬k7â¿w7ã®~7ä´µ7å°7æÕã5çØä5èal6é¡k6êad6ëÑÁ6ìËÒ6íæÖ6îÚ×6ïÆr6ðçÙ6ñÚÛ6òÉÐ6óËß6ôÍi6õkê4ökè4÷k¸4øk·4ùéê4úe¸4ûëì4üÓÔ4ýíî4þðñ4ÿãÜ4ĀäÝ4āÞó4Ăkà4ăáâ4Ąýã(ąûå(ĆÄ(ćþä(Ĉāå(ĉĂ¶(ĊÏ(ċĄõ*Čïe*čÿ÷*Ď¼e*ď~k*Đąù*đôe*Ēüú*ē¹e*ĔĆk*ĕćö*Ėòl*ėĀø*Ę¾l*ęĈù*Ěăú*ěÀe*ĜĊk*ĝĐę+ĞĒĚ+ğēě+ĠĔĜ+ġċĕ0ĢČĖ0ģčė0ĤĎĘ0ĥĝĉ0Ħđk0ħġģ/ĨĢĤ/ĩĥĞ/ĪĦğ/īĠk/Ĭħĩ-ĭĨĪ-Įďī-įĬĭ1įĮ.';

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolveFunctionByIndex,
    input
);
