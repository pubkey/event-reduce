import {
    SimpleBdd,
    minimalStringToSimpleBdd,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';
import type { StateResolveFunctionInput } from '../types/index.js';
import { stateResolveFunctionByIndex } from '../states/index.js';

export const minimalBddString = '14a1b,c+d2e5f0g/h.i4j*k-l)m(n6obh9pce9qnh9rad9scm9tae9uan9vbf9wbe9xbn9ycg9zck9{cn9|nd9}ne9~nf9ng9¡nm9¢nk9£mh9¤mi9¥mj9¦mk9§ml9¨mn9©mc8ª¤{8«¥z8¬¨s8­¨n8®mn8¯¨¡8°¨m8±pz7²ª«7³{z7´­®7µ}n7¶¤¥7·¨m7¸wo6¹µ}6ºnq6»²¬6¼tu6½wx6¾´¯6¿µn6À®¯6Á¶§6Â·£6Ã¶¨6Ä·¨6Åm¦6Æm¨6Ç¤¥5È¨m5Ém©4Êm®4ËÇ§4ÌÈ£4ÍÇ¬4ÎÃ»4ÏÈ¯4ÐÄ¾4Ñm¦4Òm¯4ÓÆÀ4Ôma3Õmn3ÖÉa3×Ên3ØËr3ÙÁt3ÚÌ|3ÛÂ¹3ÜÍr3ÝÎ¼3ÞÏ|3ßÐ¿3àØÙ2áv¸2ây±2ãÚÛ2ä~º2åµ2æÜÝ2çv½2èy³2éz{2êÞß2ë~n2ìn2íÑÅ2îÒÓ2ï¢n2ðÔb1ñÕn1òÖb1ó×n1ôàá1õâz1öãä1÷æç1øèé1ùêë1úðc0ûñn0üòc0ýón0þmn0ÿÊn0Āôõ0āöå0Ă÷ø0ăùì0Ąíï0ąîï0Ćúû/ćüý/ĈĀā/ĉĂă/ĊÁÂ/ċÃÄ/Čúm.čüm.ĎĆm.ďćm.Đþm.đÿm.ĒĀ§.ēĂ°.ĔĈ§.ĕĉ°.ĖĄ§.ėą°.ĘÁ§.ęÃ¨.ĚĊ§.ěċ¨.ĜÅ§.ĝÆ¨.ĞČč-ğĎď-ĠĐđ-ġĒē-ĢĔĕ-ģĖė-ĤĘę-ĥĚě-ĦĜĝ-ħğĠ,ĨĢģ,ĩĥĦ,ĪĞħ+īġĨ+ĬĤĩ+ĭĪī)ĭĬ(';

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
