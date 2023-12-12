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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeBddTemplate = exports.BDD_TEMPLATE_GOAL = exports.BDD_OPTIMIZE_STATE_LOCATION = exports.BDD_TEMPLATE_LOCATION = void 0;
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
exports.writeBddTemplate = writeBddTemplate;
//# sourceMappingURL=write-bdd-template.js.map