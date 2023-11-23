import 'mocha';
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
  stateResolveFunctions
} from '../../src/states/index.js';
import {
  objectToMap
} from '../../src/util.js';
import {
  readJsonFile
} from '../../src/truth-table-generator/util.js';
import { OUTPUT_TRUTH_TABLE_PATH } from '../../src/truth-table-generator/config.js';
import { StateActionIdMap, Human } from '../../src/truth-table-generator/types.js';
import { getSimpleBdd } from '../../src/bdd/bdd.generated.js';
import {
  StateResolveFunctionInput,
  QueryParams,
  MongoQuery,
  ChangeEvent
} from '../../src/types/index.js';
import {
  getQueryParamsByMongoQuery,
  getMinimongoCollection,
  applyChangeEvent,
  minimongoFind,
  minimongoUpsert
} from '../../src/truth-table-generator/minimongo-helper.js';
import { randomHuman } from '../../src/truth-table-generator/data-generator.js';
import { calculateActionName, calculateActionFromMap, runAction } from '../../src/index.js';
import { getQueryVariations } from '../../src/truth-table-generator/queries.js';
import { getTestProcedures, oneThatWasCrashing } from '../../src/truth-table-generator/procedures.js';
import deepEqual from 'deep-equal';
import { orderedActionList } from '../../src/actions/index.js';


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
          getSimpleBdd(),
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
        (sortedResolvers as any)[index] = (i: any) => {
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
              console.log('#'.repeat(20));
              console.log('#'.repeat(20));
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

    describe.only('Modifying two collection fields in one UPDATE', () => {
      type Doc = {
        _id: string;
        location: string;
        lastMoved: number;
      };

      async function setUp() {
        const collection = getMinimongoCollection<Doc>();

        // Change two fields: location and lastMoved
        //  so that the document now matches query, and should be first.
        const originalDoc = {
          _id: '1',
          location: 'archive',
          lastMoved: 300,
        };
        const updatedDoc = {
          _id: '1',
          location: 'inbox',
          lastMoved: 50,
        }

        const allDocs: Doc[] = [
          originalDoc,
          {
            _id: '2',
            location: 'inbox',
            lastMoved: 100,
          },
          {
            _id: '3',
            location: 'inbox',
            lastMoved: 200,
          },
           {
            _id: '4',
            location: 'inbox',
            lastMoved: 250,
          },
          {
            _id: '5',
            location: 'inbox',
            lastMoved: 275,
          },
        ];
        const changeEvent: ChangeEvent<Doc> = {
          operation: 'UPDATE',
          id: '1',
          doc: updatedDoc,
          previous: originalDoc,
        };
        await Promise.all(
          allDocs.map(doc => minimongoUpsert(collection, doc))
        );

        return { collection, originalDoc, updatedDoc, allDocs, changeEvent };
      }

      it('new first item with fewer than limit results', async () => {
        const { collection, originalDoc, updatedDoc, allDocs, changeEvent } = await setUp();
        const query: MongoQuery = {
          selector: {
            location: 'inbox',
          },
          sort: ['lastMoved', '_id'],
          limit: 10,
        };
        const previousResults = await minimongoFind(collection, query);
        const keyDocumentMap = new Map();
        previousResults.forEach(doc => keyDocumentMap.set(doc._id, doc));

        const input: StateResolveFunctionInput<Doc> = {
          previousResults,
          queryParams: getQueryParamsByMongoQuery(query),
          keyDocumentMap,
          changeEvent
        };

        // Right now, this incorrectly returns insertLast, when it should be an insertFirst
        const actionName = calculateActionName(input);
        const actualResultsFromMap = runAction(
          actionName,
          getQueryParamsByMongoQuery(query),
          changeEvent,
          previousResults,
          keyDocumentMap
        );

        // Update the original document (id=1) to now be in the query results
        await minimongoUpsert(collection, updatedDoc)
        const expectedResults = await minimongoFind(collection, query);

        assert.deepEqual(actualResultsFromMap, expectedResults);
      });

      it('new first item with more than limit results', async () => {
        const { collection, originalDoc, updatedDoc, allDocs, changeEvent } = await setUp();
        const query: MongoQuery = {
          selector: {
            location: 'inbox',
          },
          sort: ['lastMoved', '_id'],
          limit: 2,
        };
        const previousResults = await minimongoFind(collection, query);
        const keyDocumentMap = new Map();
        previousResults.forEach(doc => keyDocumentMap.set(doc._id, doc));

        const input: StateResolveFunctionInput<Doc> = {
          previousResults,
          queryParams: getQueryParamsByMongoQuery(query),
          keyDocumentMap,
          changeEvent
        };

        // Right now, this incorrectly returns insertLast, when it should be an insertFirst
        const actionName = calculateActionName(input);
        const actualResultsFromMap = runAction(
          actionName,
          getQueryParamsByMongoQuery(query),
          changeEvent,
          previousResults,
          keyDocumentMap
        );

        // Update the original document (id=1) to now be in the query results
        await minimongoUpsert(collection, updatedDoc)
        const expectedResults = await minimongoFind(collection, query);
        console.log(actionName, actualResultsFromMap, expectedResults);
        assert.deepEqual(actualResultsFromMap, expectedResults);
      });

      it('new item should push all results in skip query down', async () => {
        const { collection, originalDoc, updatedDoc, allDocs, changeEvent } = await setUp();
        const query: MongoQuery = {
          selector: {
            location: 'inbox',
          },
          sort: ['lastMoved', '_id'],
          limit: 2,
          skip: 2,
        };
        const previousResults = await minimongoFind(collection, query);
        const keyDocumentMap = new Map();
        previousResults.forEach(doc => keyDocumentMap.set(doc._id, doc));

        const input: StateResolveFunctionInput<Doc> = {
          previousResults,
          queryParams: getQueryParamsByMongoQuery(query),
          keyDocumentMap,
          changeEvent
        };

        // Right now, this incorrectly returns insertLast, when it should be an insertFirst
        const actionName = calculateActionName(input);
        const actualResultsFromMap = runAction(
          actionName,
          getQueryParamsByMongoQuery(query),
          changeEvent,
          previousResults,
          keyDocumentMap
        );

        // Update the original document (id=1) to push all query results down
        await minimongoUpsert(collection, updatedDoc)
        const expectedResults = await minimongoFind(collection, query);
        console.log(actionName, actualResultsFromMap, expectedResults);
        assert.deepEqual(actualResultsFromMap, expectedResults);
      });
    });
  });

});

