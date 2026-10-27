import * as fs from 'fs';
import {
    generatePortTestCases,
    getPortTestCasesPath,
    portTestCasesToJson
} from './helper/port-test-cases.js';

/**
 * Writes the test cases for the implementations in other languages.
 * Run it after the BDD changed: npm run generate-port-test-cases
 */
const cases = generatePortTestCases();
fs.writeFileSync(getPortTestCasesPath(), portTestCasesToJson(cases), 'utf-8');
console.log('wrote ' + cases.length + ' port test cases to ' + getPortTestCasesPath());
