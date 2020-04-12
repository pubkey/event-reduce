"use strict";
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
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