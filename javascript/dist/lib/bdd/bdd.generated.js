"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.getSimpleBdd = exports.minimalBddString = void 0;
var binary_decision_diagram_1 = require("binary-decision-diagram");
var states_1 = require("../states");
exports.minimalBddString = '14a2b0c/d,e+f5g1h.i4j*k-l)m(n6oin-pjn-qng-rfn-smn-thn-ukn-vln-wga:xdb:yec:zek:{na:|nb:}nc:~mo:mp:¡sv:¢gf:£gr:¤df:¥dt:¦er:§eu:¨st:©nf:ªqr:«nt:¬nr:­em:®nk:¯ms:°su:±nm:²mi:³mj:´mn:µmt:¶mu:·mv:¸gn0¹dn0ºen0»w{0¼£¬0½x|0¾y}0¿~´0À¯0Á¡¨0Â¢©0Ãfn0Ä£ª0Å¤n0Æ¥«0Ç¦¬0È­±0Ékn0Ê²´0Ë³m0Ì·µ0Í»Â3Î½Å3Ï¾Ç3Ðz§3Ñ®n3ÒÍ¼7ÓÎÆ7Ô¿Á7ÕÂÄ7ÖÅÆ7×nÈ7Ønµ7ÙÊÌ7Úmº9ÛÙ×9ÜËm9ÝËÉ9ÞmØ9ß¶±9àm¶9ámn9â·m9ãÚs/äás/åÛÔ/æÒÕ/çÝÀ/èÏÇ/éß°/êá¯/ëâ·/ìåç8íÞÜ8îæÃ8ïèÉ8ðàm8ñéê8òÙË8ó¶m8ô¸¹2õºe2öîÖ2÷ï§2øãm6ùô¹6úõe6ûäm6üìí6ýöÓ6þ÷Ð6ÿñð6ĀnÑ6āøù4Ăüý4ăĂā*Ąþú*ąëm*Ćÿû*ćĀn*ĈăĆ,ĉĄć,Ċòó,ċĈĉ1ČċĊ(čą·(Čč.';
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