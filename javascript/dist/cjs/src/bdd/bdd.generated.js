"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.getSimpleBdd = exports.minimalBddString = void 0;
const binary_decision_diagram_1 = require("binary-decision-diagram");
const index_js_1 = require("../states/index.js");
exports.minimalBddString = '14a+b1c2d5e,f0g/h.i4j*k-l)m(n6oeh9pad9qnc9rnf9snh9tng9und9vam9wbd9xbn9yed9zen9{ag9|ak9}an9~bc9ef9¡nk9¢nm9£mh9¤mi9¥mj9¦mk9§ml9¨mn9©ma8ª¤n8«¥|8¬m£8­in8®¥k8¯¨v8°h¢8±¨m8²m¦8³¨¢8´mk8µmn8¶ª«7·¤m7¸m¥7¹p|7ºµm7»un7¼­®7½wd7¾}k7¿fm7Àgn7Á¨m7Â¤¥7Ãnm7Ä¤m6Å¶¯6Ædx6Ç·m6È¸m6Éyo6Êº¬6Ë»u6Ìns6Í¥m6Î¼¯6Ï½x6Ðyz6Ñ¿n6ÒÀ°6Óm²6Ôm´6Õµm6ÖÂ§6×Á£6ØÂ¨6ÙÃ¨6Úm¦6Ûm¨6ÜÄÍ5ÝÇÈ5Þ¨m5ßÁÊ5à¤¥5áiÍ5âfÑ5ãm©4ämµ4åÜÅ4æà§4çÝÖ4èÞ£4éß×4êà¯4ëáÎ4ìâÒ4ím¦4îÓÚ4ïm³4ðÔÕ4ñmb3òmn3óãb3ôän3õåÆ3öæ~3÷çw3øèq3ùéË3úê~3ûëÏ3üm~3ýìd3þúõ2ÿö÷2ĀÉ2ā{¹2Ăøù2ărÌ2Ąt»2ąúû2ĆÐ2ć{¾2Ĉ|}2ĉüý2Ċn2ċgn2Číî2č¡n2Ďïð2ďkn2Đñe1đòn1Ēóe1ēôn1ĔþĆ1ĕÿĀ1Ėā|1ėĂă1ĘąĆ1ęćĈ1ĚĉĊ1ěĐa0Ĝđn0ĝĒa0Ğēn0ğmn0Ġän0ġĔę0ĢĕĖ0ģėĄ0ĤĘę0ĥĚċ0ĦČč0ħĎď0ĨěĜ/ĩĝĞ/ĪĢģ/īĤĥ/ĬÖ×/ĭØÙ/Įěm.įĝm.İĨm.ıĩm.Ĳğm.ĳĠm.ĴĢ§.ĵġ±.ĶĪ§.ķī±.ĸĦ§.Ĺħm.ĺÖ§.ĻØ¨.ļĬ§.Ľĭ¨.ľÚ§.ĿÛ¨.ŀĮį-Łİı-łĲĳ-ŃĴĵ-ńĶķ-ŅĸĹ-ņĺĻ-ŇļĽ-ňľĿ-ŉŁł,ŊńŅ,ŋŇň,Ōŀŉ+ōŃŊ+Ŏņŋ+ŏŌō)ŏŎ(';
let simpleBdd;
function getSimpleBdd() {
    if (!simpleBdd) {
        simpleBdd = (0, binary_decision_diagram_1.minimalStringToSimpleBdd)(exports.minimalBddString);
    }
    return simpleBdd;
}
exports.getSimpleBdd = getSimpleBdd;
const resolveInput = (input) => {
    return (0, binary_decision_diagram_1.resolveWithSimpleBdd)(getSimpleBdd(), index_js_1.stateResolveFunctionByIndex, input);
};
exports.resolveInput = resolveInput;
//# sourceMappingURL=bdd.generated.js.map