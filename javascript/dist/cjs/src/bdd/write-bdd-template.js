"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BDD_TEMPLATE_GOAL = exports.BDD_OPTIMIZE_STATE_LOCATION = exports.BDD_TEMPLATE_LOCATION = void 0;
exports.writeBddTemplate = writeBddTemplate;
const fs = __importStar(require("fs"));
const path_1 = __importDefault(require("path"));
exports.BDD_TEMPLATE_LOCATION = path_1.default.join(__dirname, './bdd.template.ts');
exports.BDD_OPTIMIZE_STATE_LOCATION = path_1.default.join(__dirname, './bdd.optimize.state.json');
exports.BDD_TEMPLATE_GOAL = path_1.default.join(__dirname, './bdd.generated.ts');
function writeBddTemplate(minimalBddString, performanceMeasurement, quality) {
    let templateString = fs.readFileSync(exports.BDD_TEMPLATE_LOCATION, 'utf-8');
    const replaceVariables = {
        minimalBddString: '\'' + minimalBddString + '\'',
    };
    Object.entries(replaceVariables).forEach(([key, content]) => {
        const contentString = content;
        const templateVar = '\'${' + key + '}\'';
        templateString = templateString.replace(templateVar, contentString);
    });
    fs.writeFileSync(exports.BDD_OPTIMIZE_STATE_LOCATION, JSON.stringify({
        performanceMeasurement,
        minimalBddString,
        quality
    }, null, 4), { encoding: 'utf8', flag: 'w' });
    fs.writeFileSync(exports.BDD_TEMPLATE_GOAL, templateString, { encoding: 'utf8', flag: 'w' });
}
//# sourceMappingURL=write-bdd-template.js.map