import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';
import { StateResolveFunctionInput } from '../types';
import { stateResolveFunctionByIndex } from '../states';

export const minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4lbd1mfk/njk/olh,pdh,qnk,reh,skg4tnj4ukj4vqj4wmf3xsg3ytj3zuj3{vj3|jk3}kj3~fw-gx-¡jy-¢jz-£j{-¤j|-¥r}-¦dk-§pk-¨rk-©ik-ª~k0«¢0¬¡£0­lo0®h¤0¯a¤0°j¥0±ck0²dp0³dk0´¦§0µfk0¶gj0·©¨0¸~k7¹h7º¡a7»dl7¼ªk7½«®7¾¬¯7¿·°7À²­7Á©j7Âjº5Ã¸Á5Ä»¦5Åj¾5Æ¼¿5ÇÀ´5Èf©5Éµ·5ÊÂÃ8Ëj¹8ÌcÄ8ÍÅÆ8Îj½8Ï±Ç8ÐjÁ8ÑjÈ8Òjg8ÓjÉ8Ôj¶8Õj©8ÖÊË6×Ìd6ØÍÎ6ÙÏ³6ÚÑÒ6ÛÓÔ6Üº¾+Ýc±+ÞÖØ+ß×Ù+àÚÛ+áÜÞ)âÝß)ãjÐ)äáâ2åäã.æàÕ.åæ(';

export const simpleBdd: SimpleBdd = minimalStringToSimpleBdd(minimalBddString);
export const resolveInput = (input: StateResolveFunctionInput<any>) => resolveWithSimpleBdd(
    simpleBdd,
    stateResolveFunctionByIndex,
    input
);
