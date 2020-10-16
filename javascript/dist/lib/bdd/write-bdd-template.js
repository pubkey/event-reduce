"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeBddTemplate = exports.BDD_TEMPLATE_GOAL = exports.BDD_TEMPLATE_LOCATION = void 0;
var fs = __importStar(require("fs"));
var path = __importStar(require("path"));
exports.BDD_TEMPLATE_LOCATION = path.join(__dirname, './bdd.template.ts');
exports.BDD_TEMPLATE_GOAL = path.join(__dirname, './bdd.generated.ts');
function writeBddTemplate(minimalBddString) {
    var templateString = fs.readFileSync(exports.BDD_TEMPLATE_LOCATION, 'utf-8');
    var replaceVariables = {
        minimalBddString: '\'' + minimalBddString + '\'',
    };
    Object.entries(replaceVariables).forEach(function (_a) {
        var _b = __read(_a, 2), key = _b[0], content = _b[1];
        var contentString = content;
        var templateVar = '\'${' + key + '}\'';
        templateString = templateString.replace(templateVar, contentString);
    });
    fs.writeFileSync(exports.BDD_TEMPLATE_GOAL, templateString, { encoding: 'utf8', flag: 'w' });
}
exports.writeBddTemplate = writeBddTemplate;
//# sourceMappingURL=write-bdd-template.js.map