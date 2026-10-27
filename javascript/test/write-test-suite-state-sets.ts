import * as fs from 'fs';
import {
    generateStateSets,
    getTestSuitePath,
    stateSetsToJson
} from './helper/test-suite.js';

/**
 * Writes test-suite/state-sets.json, run it after the BDD changed:
 * npm run generate-test-suite
 */
const stateSets = generateStateSets();
fs.writeFileSync(getTestSuitePath('state-sets.json'), stateSetsToJson(stateSets), 'utf-8');
console.log('wrote ' + stateSets.cases.length + ' state set cases to ' + getTestSuitePath('state-sets.json'));
