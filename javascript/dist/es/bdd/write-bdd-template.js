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
import * as fs from 'fs';
import * as path from 'path';
export var BDD_TEMPLATE_LOCATION = path.join(__dirname, './bdd.template.ts');
export var BDD_TEMPLATE_GOAL = path.join(__dirname, './bdd.generated.ts');
export function writeBddTemplate(minimalBddString) {
    var templateString = fs.readFileSync(BDD_TEMPLATE_LOCATION, 'utf-8');
    var replaceVariables = {
        minimalBddString: '\'' + minimalBddString + '\'',
    };
    Object.entries(replaceVariables).forEach(function (_a) {
        var _b = __read(_a, 2), key = _b[0], content = _b[1];
        var contentString = content;
        var templateVar = '\'${' + key + '}\'';
        templateString = templateString.replace(templateVar, contentString);
    });
    fs.writeFileSync(BDD_TEMPLATE_GOAL, templateString, { encoding: 'utf8', flag: 'w' });
}
//# sourceMappingURL=write-bdd-template.js.map