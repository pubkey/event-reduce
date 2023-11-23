"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.getSimpleBdd = exports.minimalBddString = void 0;
const binary_decision_diagram_1 = require("binary-decision-diagram");
const index_js_1 = require("../states/index.js");
exports.minimalBddString = '14a2b5c4d-e)f/g.h0i1j6k+l*m,n(onj:pkj:qnl:rkd:smj:tkb:umh:vnd:wng:xne:ynh:znc:{fj8|bd8}zq8~fd8hn8¡tj8¢yn8£zn8¤¢g7¥}x7¦~n7§lj7¨qn7©nv7ª¢w7«£x7¬fn7­cq6®hn6¯h6°c¨6±nv5²­x5³®g5´n©5µ°¥5¶¯ª5·²a4¸³a4¹µb4º¶b4»ªb4¼«b4½ni4¾rp3¿±´3Àhj3Áhb3Â·¹3Ã¸º3Äf{3Åf|3Æn¦3ÇÅr2ÈÃÀ2ÉÂÁ2ÊÆj2Ëkm2Ìtr2Í»s2Î¼u2Ï¬h2Ð½j2Ñ½m2Ò¿¾1ÓÉÇ1ÔÈÄ1ÕÊd1Ö©j1×ÎÌ1ØÍ¡1Ùnj1ÚÐj1ÛÑk1ÜÓÔ0Ý¥¤0Þ×Ø0ßÛÚ0àÓ×/áÒÖ/âÜÞ/ãxn/äÕÏ/åËk/æ¥x.ç©x.èÝx.é§o.êàã.ëáã.ìâã.íän.îÛn.ïÙn.ðßn.ñån.òæn-óçn-ôèé-õên-öën-÷ìí-øîn-ùïn-úðñ-ûôó,ü÷ö,ýúù,þòû+ÿõü+Āøý+āĀÿ)āþ(';
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