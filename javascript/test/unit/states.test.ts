import * as assert from 'assert';
import {
    orderedStateList,
    stateResolveFunctions,
    getStateSet,
    stateResolveFunctionByIndex
} from '../../src/states/index.js';
import { getExampleStateResolveFunctionInput } from '../helper/input.js';
import { StateResolveFunctionInput } from '../../src/types/index.js';
import { clone } from 'async-test-util';
import {
    wasSortedAfterLast,
    wasInResult,
    wasSortedBeforeFirst,
    sortParamsChanged,
    wasLimitReached,
    wasMatching,
    isSortedBeforeFirst,
    isSortedAfterLast
} from '../../src/states/state-resolver.js';
import { randomHuman } from '../../src/truth-table-generator/data-generator.js';
import { Human } from '../../src/truth-table-generator/types.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';

const pseudoCollection = mingoCollectionCreator();

describe('states.test.ts', () => {
    describe('basic', () => {
        it('should have the correct amount of states', () => {
            assert.strictEqual(
                orderedStateList.length,
                Object.keys(stateResolveFunctions).length
            );
            assert.strictEqual(
                orderedStateList.length,
                Object.keys(stateResolveFunctionByIndex).length
            );
        });
        it('stateResolveFunctions must have same sorting as orderedStateList', () => {
            assert.deepStrictEqual(
                orderedStateList,
                Object.keys(stateResolveFunctions)
            );
        });
        it('stateResolveFunctionByIndex should match orderedStateList', () => {
            orderedStateList.forEach((name, index) => {
                if (stateResolveFunctionByIndex[index] !== stateResolveFunctions[name]) {
                    throw new Error('wrong function by index ' + index + ' name: ' + name);
                }
            });
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id'],
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id'],
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id'],
                    limit: 5
                })
            };

            const ok = wasSortedBeforeFirst(input);
            assert.strictEqual(ok, false);
        });
        it('should be true', () => {
            const previousResults: Human[] = [{
                _id: 's90j6hhznefj',
                name: 'Freeman',
                gender: 'f',
                age: 25
            }];
            const updateDocId = '6eu7byz49iq9';
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: {
                        _id: updateDocId,
                        name: 'Eugenia',
                        gender: 'f',
                        age: 50
                    },
                    previous: {
                        _id: updateDocId,
                        name: 'Eugenia',
                        gender: 'f',
                        age: 16
                    },
                    id: updateDocId
                },
                previousResults,
                queryParams: pseudoCollection.getQueryParams({
                    selector: {
                        age: {
                            $gt: 20
                        }
                    },
                    sort: ['_id']
                })
            };

            const ok = wasSortedBeforeFirst(input);
            assert.ok(ok);
        });
    });
    describe('isSortedBeforeFirst()', () => {
        it('should be true', () => {
            const previousResults: Human[] = [{
                _id: 's90j6hhznefj',
                name: 'Freeman',
                gender: 'f',
                age: 25
            }];
            const updateDocId = '6eu7byz49iq9';
            const input: StateResolveFunctionInput<Human> = {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: {
                        _id: updateDocId,
                        name: 'Eugenia',
                        gender: 'f',
                        age: 50
                    },
                    previous: {
                        _id: updateDocId,
                        name: 'Eugenia',
                        gender: 'f',
                        age: 16
                    },
                    id: updateDocId
                },
                previousResults,
                queryParams: pseudoCollection.getQueryParams({
                    selector: {
                        age: {
                            $gt: 20
                        }
                    },
                    sort: ['_id']
                })
            };

            const ok = isSortedBeforeFirst(input);
            assert.ok(ok);
        });
    });
    describe('sort position when the changed document is the first or last', () => {
        function getInput(previousAges: number[], changedIndex: number, newAge: number): StateResolveFunctionInput<Human> {
            const previousResults: Human[] = previousAges.map((age, i) => randomHuman({ _id: 'id' + i, age }));
            const previous = previousResults[changedIndex];
            return {
                changeEvent: {
                    operation: 'UPDATE',
                    doc: Object.assign({}, previous, { age: newAge }),
                    previous,
                    id: previous._id
                },
                previousResults,
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
                })
            };
        }
        it('isSortedAfterLast() should be false when the last document moves forward', () => {
            assert.strictEqual(isSortedAfterLast(getInput([10, 20, 30], 2, 15)), false);
        });
        it('isSortedAfterLast() should be true when the last document stays last', () => {
            assert.strictEqual(isSortedAfterLast(getInput([10, 20, 30], 2, 25)), true);
            assert.strictEqual(isSortedAfterLast(getInput([10, 20, 30], 2, 50)), true);
        });
        it('isSortedAfterLast() should be true when the last document is the only one', () => {
            assert.strictEqual(isSortedAfterLast(getInput([10], 0, 5)), true);
        });
        it('isSortedBeforeFirst() should be false when the first document moves backward', () => {
            assert.strictEqual(isSortedBeforeFirst(getInput([10, 20, 30], 0, 25)), false);
        });
        it('isSortedBeforeFirst() should be true when the first document stays first', () => {
            assert.strictEqual(isSortedBeforeFirst(getInput([10, 20, 30], 0, 15)), true);
            assert.strictEqual(isSortedBeforeFirst(getInput([10, 20, 30], 0, 1)), true);
        });
        it('isSortedBeforeFirst() should be true when the first document is the only one', () => {
            assert.strictEqual(isSortedBeforeFirst(getInput([10], 0, 50)), true);
        });
        it('wasSortedBeforeFirst() and wasSortedAfterLast() should be true for the first and last document', () => {
            assert.strictEqual(wasSortedBeforeFirst(getInput([10, 20, 30], 0, 25)), true);
            assert.strictEqual(wasSortedAfterLast(getInput([10, 20, 30], 2, 15)), true);
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['-age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['-age', '_id']
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
                queryParams: pseudoCollection.getQueryParams({
                    selector: {
                        age: {
                            $gt: 10
                        }
                    },
                    sort: ['_id']
                })
            };
            const ok = wasMatching(input);
            assert.strictEqual(ok, true);
        });
    });
});
