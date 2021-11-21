"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.getSimpleBdd = exports.minimalBddString = void 0;
var binary_decision_diagram_1 = require("binary-decision-diagram");
var states_1 = require("../states");
exports.minimalBddString = '14a2b0c/d1e,f+g5h.i4j*k-l)m(n6ohk1pdf1qef1rin-sjn-ton-ugn-vmn-whn-xkn-yln-zdf5{ef5|wx5}df7~dz7ef7¡bk7¢e{7£g|7¤ry7¥dp7¦gk7§eq7¨gt7©ac7ªmv7«gu7¬nm7­iy7®nw7¯¤s8°«¦8±¬k8²ªm8³®v8´«n8µ¬n8¶vm8·xv8¸mn8¹­j8º®m8»xm8¼­¹3½}~3¾©°3¿¢3À¡£3Ám±3Â®º3Ãmº3Ä©´3Åb®3Æmµ3Çm»3Èx»3Ékn3Êm¸3Ë¼j6ÌÂm6ÍÆÃ6ÎÈm6Ïnm6ÐÊÇ6ÑÌÎ,ÒÍÐ,ÓÅÉ,Ô²¶,Õ³·,Ö®n,×º»,Ømf9ÙËÁ9Úym9ÛmÏ9ÜÑÒ9Ýz{2Þpq2ß½¿2à¾À2á¥§2â°¨2ãÄÓ2ä´Ö2åÝn0æÞn0çØÛ0èÙÜ0éßn0êàã0ë²Ô0ì¯Õ0íán0îâä0ï¹×0ðçv/ñåæ/òçë/óèì/ôéí/õêî/öÚy/÷òm(øóï(ùöy(ú÷ø:ûôõ:ümù:ýðñ4þúû4ÿþý*Āüm*ÿĀ.';
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