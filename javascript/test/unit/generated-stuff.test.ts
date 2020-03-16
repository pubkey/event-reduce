import * as assert from 'assert';
import {
    ResolverFunctions,
    booleanStringToBoolean,
    resolveWithSimpleBdd,
    fillTruthTable,
    createBddFromTruthTable
} from 'binary-decision-diagram';
import {
    orderedStateList,
    stateResolveFunctions,
    logStateSet
} from '../../src/states';
import {
    objectToMap
} from '../../src/util';
import {
    readJsonFile
} from '../../src/truth-table-generator/util';
import { OUTPUT_TRUTH_TABLE_PATH } from '../../src/truth-table-generator/config';
import { StateActionIdMap, Human } from '../../src/truth-table-generator/types';
import { simpleBdd } from '../../src/bdd/bdd.generated';
import { StateResolveFunctionInput, QueryParams, MongoQuery, ChangeEvent } from '../../src/types';
import { getQueryParamsByMongoQuery, getMinimongoCollection, applyChangeEvent, minimongoFind, minimongoUpsert } from '../../src/truth-table-generator/minimongo-helper';
import { randomHuman } from '../../src/truth-table-generator/data-generator';
import { calculateActionName, calculateActionFromMap, runAction } from '../../src/index';
import { getQueryVariations } from '../../src/truth-table-generator/queries';
import { getTestProcedures, insertChangeAndCleanup, oneThatWasCrashing } from '../../src/truth-table-generator/procedures';
import deepEqual = require('deep-equal');
import { orderedActionList, actionFunctions } from '../../src/actions';


describe('generated-stuff.test.ts', () => {
    const unknownValueActionId: number = 42;
    const truthTable: StateActionIdMap = objectToMap(
        readJsonFile(OUTPUT_TRUTH_TABLE_PATH)
    );
    const truthTableWithActionName = new Map();
    for (const [key, value] of truthTable.entries()) {
        const actionName = orderedActionList[value];
        truthTableWithActionName.set(key, actionName);
    }

    function getResolverFunctions(): ResolverFunctions {
        const size = orderedStateList.length;
        const resolvers: ResolverFunctions = {};
        new Array(size).fill(0).forEach((_x, index) => {
            const fn = (state: string) => booleanStringToBoolean((state as any)[index]);
            resolvers[index] = fn;
        });
        return resolvers;
    }
    describe('bdd', () => {
        it('the bdd should have the same values as the truth table', () => {
            const resolvers = getResolverFunctions();
            for (const [key, value] of truthTable.entries()) {
                const bddValue = resolveWithSimpleBdd(
                    simpleBdd,
                    resolvers,
                    key
                );
                assert.strictEqual(value, bddValue);
            }
        });
    });
    describe('event-reduce', () => {
        it('should calculate the correct action for one insert', () => {
            const insertDoc = randomHuman();
            const input: StateResolveFunctionInput<Human> = {
                previousResults: [],
                queryParams: getQueryParamsByMongoQuery({
                    selector: {},
                    sort: ['_id']
                }),
                keyDocumentMap: new Map(),
                changeEvent: {
                    operation: 'INSERT',
                    doc: insertDoc,
                    id: insertDoc._id,
                    previous: null
                }
            };
            const action = calculateActionName(input);
            assert.strictEqual('insertFirst', action);
        });
        it('should calculate the same action by input from bdds and map', async () => {
            const query = {
                selector: { gender: 'm' },
                sort: ['age', '_id']
            };
            const procedure = oneThatWasCrashing();

            fillTruthTable(
                truthTable,
                truthTable.keys().next().value.length,
                unknownValueActionId
            );
            const bdd = createBddFromTruthTable(truthTable);
            bdd.removeIrrelevantLeafNodes(unknownValueActionId);
            bdd.minimize();

            const sortedResolvers = {};
            orderedStateList.forEach((stateName, index) => {
                const fn = stateResolveFunctions[stateName];
                sortedResolvers[index] = (i: any) => {
                    const ret = fn(i);
                    // console.log('resolve: ' + index + ' returned ' + ret);
                    return ret;
                };
            });

            const collection = getMinimongoCollection();
            for (const changeEvent of procedure) {
                const resultsBefore: Human[] = await minimongoFind(collection, query);
                const keyDocumentMap = new Map();
                resultsBefore.forEach(d => keyDocumentMap.set(d._id, d));
                await applyChangeEvent(
                    collection,
                    changeEvent
                );

                const input: StateResolveFunctionInput<Human> = {
                    previousResults: resultsBefore,
                    queryParams: getQueryParamsByMongoQuery(query),
                    keyDocumentMap,
                    changeEvent
                };

                const resultFromMap = calculateActionFromMap(
                    truthTableWithActionName,
                    input
                );
                const actionFromBdd = orderedActionList[bdd.resolve(sortedResolvers, input)];
                const actionFromSmallBdd = calculateActionName(input);
                assert.strictEqual(actionFromSmallBdd, resultFromMap.action);
                assert.strictEqual(actionFromBdd, resultFromMap.action);
            }
        });
        it('should calculate the correct action for each of the example events', async () => {
            // do not use all queries and procedures as it takes too long
            const queries = getQueryVariations().slice(10, 40);
            const procedures = getTestProcedures();

            const useQueries: {
                query: MongoQuery;
                queryParams: QueryParams<Human>;
                previousResults: Human[];
                keyDocumentMap: Map<string, Human>;
                actions: string[];
            }[] = queries.map(query => {
                return {
                    query,
                    queryParams: getQueryParamsByMongoQuery(query),
                    previousResults: [],
                    keyDocumentMap: new Map(),
                    actions: []
                };
            });

            for (const procedure of procedures) {

                // clear queries
                useQueries.forEach(useQuery => {
                    useQuery.keyDocumentMap.clear();
                    useQuery.previousResults = [];
                });

                const collection = getMinimongoCollection();
                for (const changeEvent of procedure) {
                    await applyChangeEvent(
                        collection,
                        changeEvent
                    );
                    for (const useQuery of useQueries) {
                        const resultBefore = useQuery.previousResults.slice();

                        const execResults: Human[] = await minimongoFind(collection, useQuery.query);
                        const action = calculateActionName({
                            previousResults: useQuery.previousResults,
                            changeEvent,
                            queryParams: useQuery.queryParams,
                            keyDocumentMap: useQuery.keyDocumentMap
                        });
                        useQuery.actions.push(action);
                        if (action === 'runFullQueryAgain') {
                            useQuery.previousResults = execResults.slice();
                            useQuery.keyDocumentMap.clear();
                            execResults.forEach(d => useQuery.keyDocumentMap.set(d._id, d));
                        } else {
                            runAction(
                                action,
                                useQuery.queryParams,
                                changeEvent,
                                useQuery.previousResults,
                                useQuery.keyDocumentMap
                            );
                        }

                        if (useQuery.previousResults.length !== useQuery.keyDocumentMap.size) {
                            throw new Error('map not equal size');
                        }


                        // console.log('action: ' + action);
                        if (!deepEqual(
                            useQuery.previousResults,
                            execResults
                        )) {
                            console.dir(changeEvent);
                            console.dir(procedure);
                            console.log('execResults:');
                            console.dir(execResults);
                            console.log('useQuery.newResults:');
                            console.dir(useQuery.previousResults);
                            console.dir(useQuery.keyDocumentMap);
                            console.log('resultBefore:');
                            console.dir(resultBefore);
                            console.dir(useQuery.query);
                            console.log('actions:');
                            console.dir(useQuery.actions);

                            throw new Error('not equal');
                        }
                    }
                }
            }
        });
    });
    describe('issues', () => {
        it('should not have actionName: runFullQueryAgain', async () => {
            type Doc = {
                _id: string;
                var1: string;
                var2: number;
            };
            const collection = getMinimongoCollection<Doc>();
            const startResult: Doc[] = [
                {
                    _id: '39yje23e5ux0',
                    var1: '107zw1je54os',
                    var2: 3606
                },
                {
                    _id: 'x0pvalh7e0lz',
                    var1: 'p0lhxt4zh565',
                    var2: 8253
                }
            ];
            const changeEvent: ChangeEvent<Doc> = {
                operation: 'INSERT',
                id: '1b63wmdypo4p',
                doc: {
                    _id: '1b63wmdypo4p',
                    var1: 'n27ofavt3ti2',
                    var2: 19863
                },
                previous: null
            };
            const query: MongoQuery = {
                selector: {
                    var2: { $gt: 1 },
                    var1: { $gt: '' }
                },
                sort: ['var1', '_id']
            };

            await Promise.all(
                startResult.map(doc => minimongoUpsert(collection, doc))
            );
            const previousResults = await minimongoFind(collection, query);
            const keyDocumentMap = new Map();
            previousResults.forEach(doc => keyDocumentMap.set(doc._id, doc));


            const input: StateResolveFunctionInput<Doc> = {
                previousResults,
                queryParams: getQueryParamsByMongoQuery(query),
                keyDocumentMap,
                changeEvent
            };

            const resultFromMap = calculateActionFromMap(
                truthTableWithActionName,
                input
            );

            // console.dir(resultFromMap);
            // logStateSet(resultFromMap.stateSet);

            assert.ok(resultFromMap.action !== 'runFullQueryAgain');
        });
    });
});
