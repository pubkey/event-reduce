import * as assert from 'assert';
import {
    orderedActionList,
    actionFunctions
} from '../../src/actions/index.js';
import {
    ActionFunction,
    ActionName,
    ActionFunctionInput,
    ResultKeyDocumentMap
} from '../../src/types/index.js';
import { randomChangeEvent, randomHuman, randomHumans } from '../../src/truth-table-generator/data-generator.js';
import { Human } from '../../src/truth-table-generator/types.js';
import { insertFirst, insertLast, removeExisting, insertAtSortPosition } from '../../src/actions/action-functions.js';
import { mingoCollectionCreator } from '../../src/truth-table-generator/database/mingo.js';

const pseudoCollection = mingoCollectionCreator();

export function docsToMap<DocType>(
    primary: string,
    docs: DocType[]
): ResultKeyDocumentMap<DocType> {
    const map: ResultKeyDocumentMap<DocType> = new Map();
    docs.forEach(doc => {
        map.set((doc as any)[primary], doc);
    });
    return map;
}

export function runCheckedAction<DocType = any>(
    fn: ActionFunction<DocType>,
    input: ActionFunctionInput<DocType>
): void {
    const primary = input.queryParams.primaryKey;

    // fill key doc-map if not exists
    if (!input.keyDocumentMap) {
        input.keyDocumentMap = docsToMap(
            primary,
            input.previousResults
        );
    }

    const inputWithoutKeyDocMap: ActionFunctionInput<DocType> = Object.assign({}, input);
    inputWithoutKeyDocMap.previousResults = inputWithoutKeyDocMap.previousResults.slice();
    delete inputWithoutKeyDocMap.keyDocumentMap;

    fn(input);
    fn(inputWithoutKeyDocMap);

    // ensure correct all docs are also in key-doc-map
    input.previousResults.forEach(doc => {
        const mapDoc = (input.keyDocumentMap as ResultKeyDocumentMap<DocType>).get((doc as any)[primary]);
        assert.ok(mapDoc);
        assert.deepStrictEqual(doc, mapDoc);
    });

    // ensure all of key-doc-map is in docs
    const ownMap = input.keyDocumentMap = docsToMap(
        primary,
        input.previousResults
    );
    for (const [key, doc] of input.keyDocumentMap) {
        const fromOwn = ownMap.get(key);
        assert.deepStrictEqual(fromOwn, doc);
    }
}

describe('actions.test.ts', () => {
    describe('basics', () => {
        it('should have the correct amount of actions', () => {
            assert.strictEqual(
                orderedActionList.length,
                Object.keys(actionFunctions).length
            );
        });
        it('all functions should not crash on whatever input', () => {
            Object.entries(actionFunctions)
                //  except unkonwnAction and runFullQueryAgain
                .filter(entry => (entry[0] as ActionName) !== 'unknownAction')
                .filter(entry => (entry[0] as ActionName) !== 'runFullQueryAgain')
                .forEach((entry) => {
                    const fn: ActionFunction<any> = entry[1];
                    runCheckedAction(fn, {
                        previousResults: [],
                        changeEvent: randomChangeEvent([], 'INSERT'),
                        keyDocumentMap: new Map(),
                        queryParams: pseudoCollection.getQueryParams({
                            selector: {},
                            sort: ['_id']
                        })
                    });
                });
        });
    });
    describe('.insertFirst()', () => {
        it('should have the correct result', () => {
            const insertMe = randomHuman();
            const input: ActionFunctionInput<Human> = {
                previousResults: [randomHuman()],
                changeEvent: {
                    operation: 'INSERT',
                    doc: insertMe,
                    id: insertMe._id,
                    previous: null
                },
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['_id']
                })
            };
            runCheckedAction(insertFirst, input);
            const firstDoc = input.previousResults[0];
            assert.deepStrictEqual(firstDoc, insertMe);
        });
    });
    describe('.insertLast()', () => {
        it('should have the correct result', () => {
            const insertMe = randomHuman();
            const input: ActionFunctionInput<Human> = {
                previousResults: [randomHuman()],
                changeEvent: {
                    operation: 'INSERT',
                    doc: insertMe,
                    id: insertMe._id,
                    previous: null
                },
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['_id']
                })
            };
            runCheckedAction(insertLast, input);
            const lastDoc = input.previousResults.slice().pop();
            assert.deepStrictEqual(lastDoc, insertMe);
        });
    });
    describe('.removeExisting()', () => {
        it('should have the correct result', () => {
            const deleteMe = randomHuman();
            const input: ActionFunctionInput<Human> = {
                previousResults: [deleteMe],
                changeEvent: {
                    operation: 'DELETE',
                    doc: null,
                    id: deleteMe._id,
                    previous: deleteMe
                },
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['_id']
                })
            };
            runCheckedAction(removeExisting, input);
            assert.equal(input.previousResults.length, 0);
        });
    });
    describe('.insertAtSortPosition()', () => {
        it('should have added it to empty list', () => {
            const insertMe = randomHuman();
            const input: ActionFunctionInput<Human> = {
                previousResults: [],
                changeEvent: {
                    operation: 'INSERT',
                    doc: insertMe,
                    id: insertMe._id,
                    previous: null
                },
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['_id']
                })
            };
            runCheckedAction(insertAtSortPosition, input);
            const firstDoc = input.previousResults[0];
            assert.deepStrictEqual(firstDoc, insertMe);
        });
        it('should have inserted as last', () => {
            const insertMe = randomHuman();
            insertMe.age = 1000;
            const input: ActionFunctionInput<Human> = {
                previousResults: randomHumans(10),
                changeEvent: {
                    operation: 'INSERT',
                    doc: insertMe,
                    id: insertMe._id,
                    previous: null
                },
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['age', '_id']
                })
            };
            runCheckedAction(insertAtSortPosition, input);
            const lastDoc = input.previousResults.slice().pop();
            assert.deepStrictEqual(lastDoc, insertMe);
        });
        it('should have sorted by second key', () => {
            const name = 'alice';
            const insertMe = randomHuman();
            insertMe.name = name;
            insertMe.age = 1;
            const input: ActionFunctionInput<Human> = {
                previousResults: randomHumans(20, {
                    name,
                    age: 100
                }),
                changeEvent: {
                    operation: 'INSERT',
                    doc: insertMe,
                    id: insertMe._id,
                    previous: null
                },
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['name', 'age', '_id']
                })
            };
            runCheckedAction(insertAtSortPosition, input);
            const doc = input.previousResults[0];
            assert.deepStrictEqual(doc, insertMe);
        });
        it('should sort by _id if all is equal', () => {
            const partial: Partial<Human> = {
                name: 'alice',
                age: 100
            };

            const insertMe = randomHuman(partial);
            insertMe._id = '000000000';

            const input: ActionFunctionInput<Human> = {
                previousResults: randomHumans(20, partial),
                changeEvent: {
                    operation: 'INSERT',
                    doc: insertMe,
                    id: insertMe._id,
                    previous: null
                },
                queryParams: pseudoCollection.getQueryParams({
                    selector: {},
                    sort: ['name', 'age', '_id']
                })
            };
            runCheckedAction(insertAtSortPosition, input);
            const doc = input.previousResults[0];
            assert.deepStrictEqual(doc, insertMe);
        });
    });

});
