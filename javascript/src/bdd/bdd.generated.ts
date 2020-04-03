import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';

import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4lfk7mja7ngh7ojk7pkj7qfl1rbd1sng4tmj4uoj4vpk4wrd5xjt5yqp5zju5{kv5|rk5}jk5~dk5hk5¡fi5¢ke5£fk5¤tk/¥wd/¦x}/§yk/¨sk/©z}/ª{k/«|~/¬uk/­vk/®pk/¯¥d6°¦j6±§¨6²«d6³¥k6´©j6µª¬6¶«k6·hk6¸¬j6¹­¬6ºk6»¡g6¼£g6½¢j6¾hj6¿kj6À¤°)Á¬´)Â¬¸)ÃjÀ-ÄjÁ-ÅjÂ-Æ»±-Ç¯²-È½µ-É³¶-Ê¾¹-Ë·º-Ìi®-Í»¼-Î½¿-Ï¾¿-Ðik-ÑÃj(ÒÄj(ÓÅj(ÔÆÍ(ÕÌÐ(ÖÈÎ(×ÊÏ(ØÑc2ÙÒk2ÚÓk2ÛÔÇ2ÜÖÉ2Ý×Ë2ÞØÙ0ßÛÜ0àÞÚ,áßÝ,âàj.ãáÕ.âã8';

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolveFunctionByIndex,
    input
);
