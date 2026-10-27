import assert from 'assert';
import * as fs from 'fs';
import {
    generatePortTestCases,
    getPortTestCasesPath,
    portTestCasesToJson
} from '../helper/port-test-cases.js';

describe('port-test-cases.test.ts', () => {
    it('the test cases of the other implementations must match the current BDD', () => {
        const expected = portTestCasesToJson(generatePortTestCases());
        const actual = fs.readFileSync(getPortTestCasesPath(), 'utf-8');
        assert.ok(
            actual === expected,
            'test/fixtures/port-test-cases.json is outdated, run: npm run generate-port-test-cases'
        );
    });
});
