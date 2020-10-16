"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInput = exports.simpleBdd = exports.minimalBddString = void 0;
var binary_decision_diagram_1 = require("binary-decision-diagram");
var states_1 = require("../states");
exports.minimalBddString = '11a+b0c/d3e.f2g*h-i)j(k4ljk3mkj3nbh,odh,peh,qkj5rkm5sdk5tjk5uok5vfi5wkp5xfk5yxk/zgk/{jt/|jk/}bd1~xy1gz1¡jq1¢bs1£no1¤j{1¥j|1¦jl1§kl1¨jr1©nu1ª|a7«|l7¬d}7­¤a7®~¡7¯h7°s¢7±kj7²o£7³¤§7´k¨7µ¥¦7¶u©7·vg6¸¬d6¹­j6º®¯6»°d6¼wj6½²k6¾³j6¿´µ6À¶k6Á¹ª*Â¾«*ÃjÁ-ÄjÂ-Å·º-Æ¸»-Çi±-È¼¿-É½À-ÊÃc2ËÄk2ÌÅÆ2ÍÈÉ2ÎÊË0ÏÌÍ0ÐÎÏ8ÑjÇ8ÐÑ.';
exports.simpleBdd = binary_decision_diagram_1.minimalStringToSimpleBdd(exports.minimalBddString);
exports.resolveInput = function (input) { return binary_decision_diagram_1.resolveWithSimpleBdd(exports.simpleBdd, states_1.stateResolveFunctionByIndex, input); };
//# sourceMappingURL=bdd.generated.js.map