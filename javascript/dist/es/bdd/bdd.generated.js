import { minimalStringToSimpleBdd, resolveWithSimpleBdd } from 'binary-decision-diagram';
import { stateResolveFunctionByIndex } from '../states';
export var minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4lkj5mjk5ndk5ohk5pfi5qfk5rke5sfi3tfp3ufk3vfq3wke3xkr3yst1zuv1{wx1|bd1}jl1~bn1ho1¡}k4¢kj4£jk4¤y{0¥zk0¦a¢0§}¡0¨h¢0©ck0ªdk0«pr0¬qk0­gj0®¤r7¯­j7°j¦7±¥§7²­¨7³j¢7´k£7µkj7¶j°-·®±-¸¯²-¹|~-ºjm-»«k-¼­k-½dn-¾j³-¿h´-Àh-Ájk-Âho-Ãiµ-Ä«¬-Åhk-Æik-ÇÁ©2È¶©2É·¹2Ê¸ª2Ëº©2Ì»½2Í¼ª2Î¾k2Ï¿À2ÐÁk2ÑÅÂ2ÒÇÐ,ÓÈÎ,ÔÉÏ,ÕÊÎ,ÖËÐ,×ÌÑ,ØÍÐ,ÙÄÅ,Ú­j,ÛÓÒ/ÜÓÖ/ÝÔ×/ÞÕØ/ßÃÆ/àÜj6áÝÞ6âÙÚ6ãàj(äáâ(åßÆ(æÛj.çãj.èäå.éçè8éæ*';
export var simpleBdd = minimalStringToSimpleBdd(minimalBddString);
export var resolveInput = function (input) { return resolveWithSimpleBdd(simpleBdd, stateResolveFunctionByIndex, input); };
//# sourceMappingURL=bdd.generated.js.map