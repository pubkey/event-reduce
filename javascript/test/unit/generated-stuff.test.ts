import * as assert from 'assert';
import {
    ResolverFunctions,
    booleanStringToBoolean,
    resolveWithSimpleBdd
} from 'binary-decision-diagram';
import {
    FIRST_STATE_SET,
    getNextStateSet,
    decimalToPaddedBinary,
    binaryToDecimal,
    LAST_STATE_SET
} from '../../src/truth-table-generator/binary-state';
import {
    orderedStateList
} from '../../src/states';
import {
    objectToMap,
    readJsonFile
} from '../../src/util';
import { OUTPUT_TRUTH_TABLE_PATH } from '../../src/truth-table-generator/config';
import { StateActionIdMap, Human, MongoQuery } from '../../src/truth-table-generator/types';
import { simpleBdd, valueMapping } from '../../src/bdd/bdd.generated';
import { StateResolveFunctionInput, QueryParams } from '../../src/types';
import { getQueryParamsByMongoQuery, getMinimongoCollection, applyChangeEvent, minimongoFind } from '../../src/truth-table-generator/minimongo-helper';
import { randomHuman } from '../../src/truth-table-generator/data-generator';
import { calculateActionName, calculateActionFromMap, runAction } from '../../src/index';
import { getQueryVariations } from '../../src/truth-table-generator/queries';
import { getTestProcedures, insertChangeAndCleanup } from '../../src/truth-table-generator/procedures';
import deepEqual = require('deep-equal');
import { orderedActionList } from '../../src/actions';


describe('generated-stuff.test.ts', () => {
    const truthTable: StateActionIdMap = objectToMap(
        readJsonFile(OUTPUT_TRUTH_TABLE_PATH)
    );
    const truthTableWithActionName = new Map();
    for (const [key, value] of truthTable.entries()) {
        const actionName = orderedActionList[value];
        truthTableWithActionName.set(key, actionName);
    }

    function getResolverFunctions(mapping: any): ResolverFunctions {
        const size = Object.keys(mapping).length;
        const resolvers: ResolverFunctions = {};
        new Array(size).fill(0).forEach((_x, index) => {
            const useIndex = mapping[index + ''];
            const fn = (state: string) => booleanStringToBoolean((state as any)[useIndex]);
            resolvers[index] = fn;
        });
        return resolvers;
    }
    describe('bdd', () => {
        it('the bdd should have the same values as the truth table', () => {
            const resolvers = getResolverFunctions(
                valueMapping
            );
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
                    selector: {}
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
        it('should calculate the same action by input from bdd and map', async () => {
            const query = {
                selector: { gender: 'm' },
                sort: ['age']
            };
            const procedure = insertChangeAndCleanup();
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
                    // keyDocumentMap,
                    changeEvent
                };
                const actionFromBdd = calculateActionName(input);
                const resultFromMap = calculateActionFromMap(
                    truthTableWithActionName,
                    input
                );
                console.dir(resultFromMap);
                assert.strictEqual(actionFromBdd, resultFromMap.action);
            }

            process.exit();
        });
        it('should calculate the correct action for each of the example events', async () => {
            const queries: MongoQuery[] = [{
                selector: { gender: 'm' },
                sort: ['age']
            }];
            //            queries = getQueryVariations();
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
                console.log('procedure:');

                // clear queries
                useQueries.forEach(useQuery => {
                    useQuery.keyDocumentMap.clear();
                    useQuery.previousResults = [];
                });

                const collection = getMinimongoCollection();
                for (const changeEvent of procedure) {
                    console.log('###'.repeat(30));


                    console.log('results before apply:');
                    const resultBeforeApply = await minimongoFind(collection, queries[0]);
                    console.dir(resultBeforeApply);

                    await applyChangeEvent(
                        collection,
                        changeEvent
                    );
                    await new Promise(res => setTimeout(res, 30));

                    for (const useQuery of useQueries) {
                        const resultBefore = useQuery.previousResults.slice();

                        const execResults: Human[] = await minimongoFind(collection, useQuery.query);
                        const action = calculateActionName({
                            previousResults: useQuery.previousResults,
                            changeEvent,
                            queryParams: useQuery.queryParams,
                            keyDocumentMap: useQuery.keyDocumentMap
                        });

                        const actionFromMap = calculateActionFromMap(
                            truthTable as any,
                            {
                                previousResults: useQuery.previousResults,
                                changeEvent,
                                queryParams: useQuery.queryParams,
                                keyDocumentMap: useQuery.keyDocumentMap
                            }
                        );
                        console.log(':actionFromMap: ');
                        console.dir(actionFromMap);


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


                            console.dir(collection);

                            throw new Error('not equal');
                        }
                    }
                }
            }
        });
    });
});
