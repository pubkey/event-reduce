import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4lkh6mdk6nhk6ofg6pkj6qfg4rkj4smd5tlj5udk5vmk5wnh5xkj5ynk5zoi5{pe5|ok5}pk5~jh5jk5¡r{7¢ja7£|t7¤rj7¥r}7¦}x7§j~7¨j7©jk7ªx7«kj7¬jk-­j¢-®z£-¯e«-°¡¥-±{¦-²zk-³du-´{k-µsv-¶j©-·h«-¸§¨-¹~ª-ºj-»~k-¼wy-½i«-¾z|-¿{}-À~-Áik-Â½®1Ãb³1Ä¤°1Å¯±1Æbµ1Çj¸1È·¹1Éh¼1Ê¬c2Ë¬k2Ìjc2ÍqÃ2ÎÄÆ2Ïºc2Ð²³2Ñ´µ2Òjk2ÓÇÉ2Ôºk2Õ»¼2ÖÎÓ,×ÅÈ,ØÑÕ,Ù¿À,ÚÌ­3ÛÍÂ3ÜÒ¶3ÝÖ×3ÞÚÊ/ßÜË/à½Á/áÚÏ/âÛÐ/ãÜÔ/äÝØ/åÁà)æjá)ç¾â)èjã)éÙä)êæÞ*ëèß*ìêë0íçé0îêç8ïjå8ðìí8ñîð+ñï.';

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolveFunctionByIndex,
    input
);
