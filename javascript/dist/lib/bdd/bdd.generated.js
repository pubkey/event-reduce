"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.getSimpleBdd = exports.minimalBddString = void 0;
var binary_decision_diagram_1 = require("binary-decision-diagram");
var states_1 = require("../states");
exports.minimalBddString = '14a2b0c/d,e+f5g1h.i4j*k-l)m(n6ohk1pge1qde1rgn1sin9tjk9ume9vbn9wmn9xnm9yfh7zfo7{mu7|sx7}mw7~vx7gp7¡fk7¢dq7£mn7¤nr7¥fn7¦il7§nh7¨in7©l¦3ªby3«n§3¬h§3­af3®b§3¯cf3°u{3±x|3²b¥3³w}3´x~3µgn3¶a¥3·bn3¸cn3¹kn3ºmp4»ue4¼np4½i­4¾me4¿©¯4Àjk4Á«­4Â¬¯4Ãm4Ä¦f4Åj¡4Æ§f4Çmg4Èi¶4Éjf4Ê°e4Ë±¸4Ìtk4Ímµ4Î·¶4Ïmn4Ð³n4Ñ´¸4Òwn4Ó£4Ôn¡4Õ£¤4Ön¥4×ºÏ0Ø»Ò0Ù¼n0Úqn0ÛÇÏ0Ü½Á0Ý¾Ï0Þ¿Â0ßÀÏ0àª®0áÃÏ0âÄÆ0ãÅÏ0äz§0åÇÍ0æÈÎ0çÉÏ0èÊÐ0éËÑ0êÌÒ0ëdn0ì²·0íÓÕ0îÔn0ï¢n0ð¥n0ñ¦§0ò¨n0ójm0ô×m,õÚn,öØw,÷Ùn,øÛm,ùÜk,úÝm,ûÞk,üßm,ýen,þk¹,ÿám,Āâk,āãm,Ăïn,ăän,Ąåm,ąæn,Ćçm,ćèw,Ĉéx,ĉêw,Ċín,ċÖn,Čîn,čðn,Ďñk,ďòn,Đóm,đ½É8Ē¾m8ē¿À8ĔÃm8ĕÄÅ8ĖÇm8ėÈÉ8ĘÊm8ęËÌ8ĚÓm8ěÖÔ8Ĝøm8ĝùĆ8Ğúm8ğûü8Ġÿm8ġĀā8ĢĄm8ģąĆ8Ĥćm8ĥĈĉ8ĦĊm8ħċČ8Ĩ¦j8ĩ¨j8ĪĎĐ8īďĐ8ĬÇø+ĭ¾ú+Įºô+įqõ+İ»ö+ı¼÷+ĲĖĜ+ĳđĝ+ĴĒĞ+ĵēğ+Ķdë+ķªà+ĸeý+Ĺkþ+ĺĔĠ+Ļĕġ+ļ¢Ă+Ľză+ľĖĢ+Ŀėģ+ŀĘĤ+Łęĥ+ł²ì+ŃĚĦ+ńěħ+Ņ¥č+ņĨĪ+Ňĩī+ňĭİ-ŉĮı-ŊĲľ-ŋĳĿ-ŌĴŀ-ōĵŁ-Ŏķł-ŏĹ¹-ŐĺŃ-őĻń-ŒĽŅ-œlx-ŔņŇ-ŕln-ŖĬĶ2ŗňĸ2Řŉį2řŊĶ2ŚŋŎ2śŌĸ2Ŝōŏ2ŝŐļ2ŞőŒ2şřŚ:ŠśŜ:šŝŞ:Ţmœ:ţmŔ:Ťmŕ:ťŖŘ/Ŧşš/ŧŢŤ/ŨťŦ)ũŗŠ)Ūmŧ)ūŨũ5ŬūŪ.ŭţŤ.Ŭŭ(';
var simpleBdd;
function getSimpleBdd() {
    if (!simpleBdd) {
        simpleBdd = (0, binary_decision_diagram_1.minimalStringToSimpleBdd)(exports.minimalBddString);
    }
    return simpleBdd;
}
exports.getSimpleBdd = getSimpleBdd;
var resolveInput = function (input) {
    return (0, binary_decision_diagram_1.resolveWithSimpleBdd)(getSimpleBdd(), states_1.stateResolveFunctionByIndex, input);
};
exports.resolveInput = resolveInput;
//# sourceMappingURL=bdd.generated.js.map