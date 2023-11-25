"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FUZZING_PROCEDURES_PATH = exports.FUZZING_QUERIES_PATH = exports.OUTPUT_TRUTH_TABLE_PATH = exports.OUTPUT_FOLDER_PATH = void 0;
const path_1 = __importDefault(require("path"));
exports.OUTPUT_FOLDER_PATH = path_1.default.join(__dirname, 'output');
exports.OUTPUT_TRUTH_TABLE_PATH = path_1.default.join(exports.OUTPUT_FOLDER_PATH, 'truth-table.json').replace('dist/cjs/', '');
exports.FUZZING_QUERIES_PATH = path_1.default.join(exports.OUTPUT_FOLDER_PATH, 'queries.json').replace('dist/cjs/', '');
exports.FUZZING_PROCEDURES_PATH = path_1.default.join(exports.OUTPUT_FOLDER_PATH, 'procedures.json').replace('dist/cjs/', '');
//# sourceMappingURL=config.js.map