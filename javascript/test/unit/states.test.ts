import * as assert from 'assert';
import {
    orderedStateList,
    stateResolveFunctions,
    getStateSet
} from '../../src/states';
import { getExampleStateResolveFunctionInput } from '../helper/input';
import { StateResolveFunctionInput } from '../../src/types';
import { clone } from 'async-test-util';
import {
    wasSortedAfterLast,
    wasInResult,
    wasSortedBeforeFirst,
    sortParamsChanged,
    wasLimitReached,
    wasMatching
} from '../../src/states/state-resolver';
import { randomHuman } from '../../src/truth-table-generator/data-generator';
import { getQueryParamsByMongoQuery } from '../../src/truth-table-generator/minimongo-helper';
import { Human } from '../../src/truth-table-generator/types';

describe('states.test.ts', () => {
    describe('basic', () => {
        it('should have the correct amount of states', () => {
            assert.strictEqual(
                orderedStateList.length,
                Object.keys(stateResolveFunctions).length
            );
        });
    });
    describe('getStateSet()', () => {
        it('should have length equal to the amount of states', () => {
            const stateSet = getStateSet(
                getExampleStateResolveFunctionInput()
            );
            assert.strictEqual(
                stateSet.length,
                orderedStateList.length
            );
        });
    });
    describe('.wasSortedAfterLast()', () => {
        it('should be true', () => {
            const inResult = randomHuman();
            inResult.age = 100;

            const previous = randomHuman();
            previous.age = 101;
            const current = clone(randomHuman);
            current.age = 102;

            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [
                    inResult
                ],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age']
                })
            };

            const ok = wasSortedAfterLast(input);
            assert.ok(ok);
        });
        it('should be false', () => {
            const inResult = randomHuman();
            inResult.age = 100;

            const previous = randomHuman();
            previous.age = 50;
            const current = clone(randomHuman);
            current.age = 51;

            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [
                    inResult
                ],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age']
                })
            };

            const ok = wasSortedAfterLast(input);
            assert.equal(ok, false);
        });
    });
    describe('.wasLimitReached()', () => {
        it('should be true', () => {
            const newDoc = randomHuman();
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'INSERT',
                    doc: newDoc,
                    previous: null,
                    id: newDoc._id
                },
                previousResults: new Array(5).fill(0).map(() => randomHuman()),
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age'],
                    limit: 5
                })
            };
            const ok = wasLimitReached(input);
            assert.strictEqual(ok, true);
        });
        it('should be false', () => {
            const newDoc = randomHuman();
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'INSERT',
                    doc: newDoc,
                    previous: null,
                    id: newDoc._id
                },
                previousResults: new Array(1).fill(0).map(() => randomHuman()),
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age'],
                    limit: 5
                })
            };
            const ok = wasLimitReached(input);
            assert.strictEqual(ok, false);
        });
    });
    describe('.wasSortedBeforeFirst()', () => {
        it('should be false', () => {
            const inResult = randomHuman();
            inResult.age = 100;

            const previous = randomHuman();
            previous.age = 101;
            const current = clone(randomHuman);
            current.age = 102;

            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [
                    inResult
                ],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age'],
                    limit: 5
                })
            };

            const ok = wasSortedBeforeFirst(input);
            assert.strictEqual(ok, false);
        });
    });
    describe('.wasInResult()', () => {
        it('should be true', () => {
            const previous = randomHuman();
            const current = clone(randomHuman);
            current.age = 102;

            const keyDocMap = new Map();
            keyDocMap.set(previous._id, previous);
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [
                    previous
                ],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age']
                }),
                keyDocumentMap: keyDocMap
            };

            const ok = wasInResult(input);
            assert.ok(ok);
        });
        it('should be true without keyDocMap', () => {
            const previous = randomHuman();
            const current = clone(randomHuman);
            current.age = 102;
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [
                    previous
                ],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age']
                })
            };

            const ok = wasInResult(input);
            assert.ok(ok);
        });
        it('should be false when not in results', () => {
            const previous = randomHuman();
            const current = clone(randomHuman);
            current.age = 102;
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age']
                })
            };

            const ok = wasInResult(input);
            assert.strictEqual(ok, false);
        });
    });
    describe('.sortParamsChanged()', () => {
        it('should be true on normal sort of age', () => {
            const previous = randomHuman();
            const current = clone(randomHuman);
            current.age = 102;
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age']
                })
            };
            const ok = sortParamsChanged(input);
            assert.strictEqual(ok, true);
        });
        it('should be false on normal sort of age', () => {
            const previous = randomHuman();
            const current = clone(randomHuman);
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['age']
                })
            };
            const ok = sortParamsChanged(input);
            assert.strictEqual(ok, true);
        });
        it('should be true on negative sort of age', () => {
            const previous = randomHuman();
            const current = clone(randomHuman);
            current.age = 102;
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['-age']
                })
            };
            const ok = sortParamsChanged(input);
            assert.strictEqual(ok, true);
        });
        it('should be false on negative sort of age', () => {
            const previous = randomHuman();
            const current = clone(randomHuman);
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['-age']
                })
            };
            const ok = sortParamsChanged(input);
            assert.strictEqual(ok, true);
        });
    });
    describe('.wasMatching()', () => {
        it('should be true', () => {
            const previous = randomHuman();
            previous.age = 100;
            const current = clone(randomHuman);
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: current,
                    previous,
                    id: previous._id
                },
                previousResults: [],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {
                        age: {
                            $gt: 10
                        }
                    }
                })
            };
            const ok = wasMatching(input);
            assert.strictEqual(ok, true);
        });
    });
});
