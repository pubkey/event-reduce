import assert from 'assert';
import * as fs from 'fs';
import {
    applyChangeEventsToResultWindowBuffer,
    applyChangeEventToResultWindowBuffer,
    calculateActionName,
    createResultWindowBuffer,
    getRecommendedResultWindowBufferSize,
    getResultWindowBufferQuery,
    getResultWindowBufferResults,
    getStateSet,
    resetResultWindowBuffer,
    runAction
} from '../../src/index.js';
import type { ActionName, ChangeEvent } from '../../src/types/index.js';
import {
    generateStateSets,
    getTestSuitePath,
    getTestSuiteQueryParams,
    stateSetsToJson
} from '../helper/test-suite.js';
import type { StateSets, TestSuiteChangeEvent, TestSuiteDoc, TestSuiteQuery } from '../helper/test-suite.js';

/**
 * Runs the test suite that all implementations share, see ../test-suite/README.md.
 * This is the reference implementation, so the expected values of the suite must match it.
 */

type ActionCase = {
    name: string;
    query: TestSuiteQuery;
    previousResults: TestSuiteDoc[];
    useKeyDocumentMap: boolean;
    changeEvent: TestSuiteChangeEvent;
    action?: ActionName;
    expectedAction?: ActionName;
    expectedError?: string;
    expectedResults: TestSuiteDoc[];
    expectedKeyDocumentMap?: TestSuiteDoc[];
};
type BufferSize = number | 'all';
type BufferStep =
    { op: 'query'; expected: { skip: number; limit: number | null; }; } |
    { op: 'reset'; rows: TestSuiteDoc[]; } |
    { op: 'results'; expected?: string[]; expectedError?: string; } |
    { op: 'applyChangeEvent'; changeEvent: TestSuiteChangeEvent; expected: string; } |
    {
        op: 'applyChangeEvents';
        changeEvents: TestSuiteChangeEvent[];
        expected: { runFullQueryAgain: boolean; changed?: boolean; results?: string[]; };
    } |
    { op: 'inspect'; expected: { buffer: string[]; offset: number; complete: boolean; }; };
type BufferScenario = {
    name: string;
    query: TestSuiteQuery;
    limitBufferSize: BufferSize;
    skipBufferSize: BufferSize;
    steps: BufferStep[];
};
type Cases = {
    actions: ActionCase[];
    resultWindowBuffer: BufferScenario[];
    recommendedResultWindowBufferSize: [number | null, number][];
};

const toChangeEvent = (event: TestSuiteChangeEvent) => event as ChangeEvent<TestSuiteDoc>;
const errorCode = (err: Error) => err.message.replace('EventReduce:', '');
const ids = (docs: TestSuiteDoc[]) => docs.map(doc => doc.id);
const bufferSize = (size: BufferSize) => size === 'all' ? Infinity : size;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('test-suite.test.ts', () => {
    const stateSetsJson = fs.readFileSync(getTestSuitePath('state-sets.json'), 'utf-8');
    const stateSets: StateSets = JSON.parse(stateSetsJson);
    const cases: Cases = JSON.parse(fs.readFileSync(getTestSuitePath('cases.json'), 'utf-8'));

    it('state-sets.json must match the current BDD', () => {
        assert.ok(
            stateSetsJson === stateSetsToJson(generateStateSets()),
            'test-suite/state-sets.json is outdated, run: npm run generate-test-suite'
        );
    });
    it('state sets and actions', () => {
        stateSets.cases.forEach((testCase, index) => {
            const input = {
                queryParams: getTestSuiteQueryParams(testCase.query),
                changeEvent: toChangeEvent(testCase.changeEvent),
                previousResults: testCase.previousResults
            };
            assert.strictEqual(getStateSet(input), testCase.stateSet, 'state set of case #' + index);
            assert.strictEqual(calculateActionName(input), testCase.action, 'action of case #' + index);
        });
    });
    describe('actions', () => {
        cases.actions.forEach(testCase => {
            it(testCase.name, () => {
                const queryParams = getTestSuiteQueryParams(testCase.query);
                const changeEvent = toChangeEvent(clone(testCase.changeEvent));
                const results = clone(testCase.previousResults);
                const keyDocumentMap = testCase.useKeyDocumentMap ? new Map(results.map(doc => [doc.id, doc])) : undefined;
                let action = testCase.action;
                if (!action) {
                    action = calculateActionName({ queryParams, changeEvent, previousResults: results, keyDocumentMap });
                    assert.strictEqual(action, testCase.expectedAction);
                }
                let error: string | undefined;
                try {
                    runAction(action, queryParams, changeEvent, results, keyDocumentMap);
                } catch (err: any) {
                    error = errorCode(err);
                }
                assert.strictEqual(error, testCase.expectedError);
                assert.deepStrictEqual(results, testCase.expectedResults);
                if (keyDocumentMap) {
                    const map = Array.from(keyDocumentMap.values()).sort((a, b) => a.id < b.id ? -1 : 1);
                    assert.deepStrictEqual(map, testCase.expectedKeyDocumentMap);
                }
            });
        });
    });
    describe('result window buffer', () => {
        cases.resultWindowBuffer.forEach(scenario => {
            it(scenario.name, () => {
                const buffer = createResultWindowBuffer(getTestSuiteQueryParams(scenario.query), {
                    limitBufferSize: bufferSize(scenario.limitBufferSize),
                    skipBufferSize: bufferSize(scenario.skipBufferSize)
                });
                scenario.steps.forEach((step, index) => {
                    const context = 'step #' + index + ' ' + step.op;
                    switch (step.op) {
                        case 'query': {
                            const query = getResultWindowBufferQuery(buffer, {});
                            assert.deepStrictEqual(
                                { skip: query.skip, limit: query.limit === undefined ? null : query.limit },
                                step.expected,
                                context
                            );
                            break;
                        }
                        case 'reset':
                            resetResultWindowBuffer(buffer, clone(step.rows));
                            break;
                        case 'results': {
                            let results: string[] | undefined;
                            let error: string | undefined;
                            try {
                                results = ids(getResultWindowBufferResults(buffer));
                            } catch (err: any) {
                                error = errorCode(err);
                            }
                            assert.deepStrictEqual(results, step.expected, context);
                            assert.strictEqual(error, step.expectedError, context);
                            break;
                        }
                        case 'applyChangeEvent':
                            assert.strictEqual(
                                applyChangeEventToResultWindowBuffer(buffer, toChangeEvent(clone(step.changeEvent))),
                                step.expected,
                                context
                            );
                            break;
                        case 'applyChangeEvents': {
                            const result = applyChangeEventsToResultWindowBuffer(buffer, clone(step.changeEvents).map(toChangeEvent));
                            assert.deepStrictEqual(
                                result.runFullQueryAgain ?
                                    { runFullQueryAgain: true } :
                                    { runFullQueryAgain: false, changed: result.changed, results: ids(result.results) },
                                step.expected,
                                context
                            );
                            break;
                        }
                        case 'inspect':
                            assert.deepStrictEqual(
                                { buffer: ids(buffer.buffer), offset: buffer.offset, complete: buffer.complete },
                                step.expected,
                                context
                            );
                            break;
                    }
                });
            });
        });
    });
    it('recommended result window buffer size', () => {
        cases.recommendedResultWindowBufferSize.forEach(([limit, size]) => {
            assert.strictEqual(getRecommendedResultWindowBufferSize(limit === null ? undefined : limit), size, 'limit ' + limit);
        });
    });
});
