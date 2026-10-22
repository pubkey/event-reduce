import {
    calculateActionName,
    runAction,
    ChangeEvent,
    QueryParams,
    applyChangeEventToResultWindowBuffer,
    createResultWindowBuffer,
    getResultWindowBufferQuery,
    getResultWindowBufferResults,
    ResultWindowBuffer,
    resetResultWindowBuffer
} from 'event-reduce-js';
import type { Human } from '../src/types';
import {
    EventGenerator,
    getTestQueryParams,
    idsOf,
    MemoryTable,
    TestQuery
} from './result-window-buffer-memory-db';

/**
 * Measures how many events need a full query, with and without the result window buffer.
 * Run with: npm run benchmark:result-window-buffer
 *
 * The same seeded events are applied to an in-memory table with 10,000 rows.
 * After each event, every strategy updates its result,
 * and the result is compared with a full query.
 */

const ROWS = 10000;
const EVENTS = 5000;
const SEED = 2026;
// used as limitBufferSize and as skipBufferSize
const BUFFER_SIZES = [0, 5, 20, 50];
const QUERIES: TestQuery[] = [
    { sortDirection: 'asc', limit: 20 },
    { sortDirection: 'asc', limit: 100 },
    { sortDirection: 'asc', skip: 20, limit: 20 },
    { sortDirection: 'asc', skip: 20 }
];
const WEIGHTS = { insert: 1, update: 3, delete: 1 };

/**
 * uniform: every row is equally likely to change.
 * visible: 40 % of the events update or delete a row of the visible result,
 * like a user who edits or removes what they see. The other 60 % are uniform.
 */
type EventMix = 'uniform' | 'visible';

type Strategy = {
    name: string;
    fullQueries: number;
    time: number;
    rowsRead: number;
    wrongResults: number;
    update(changeEvent: ChangeEvent<Human>, table: MemoryTable): Human[];
};

function eventReduceStrategy(queryParams: QueryParams<Human>, table: MemoryTable): Strategy {
    let results = table.query(queryParams);
    let keyDocumentMap = new Map(results.map(d => [d._id, d]));
    const strategy: Strategy = {
        name: 'EventReduce',
        fullQueries: 0,
        time: 0,
        rowsRead: 0,
        wrongResults: 0,
        update(changeEvent, t) {
            const action = calculateActionName({ queryParams, changeEvent, previousResults: results, keyDocumentMap });
            if (action === 'runFullQueryAgain') {
                strategy.fullQueries++;
                results = t.query(queryParams);
                strategy.rowsRead += results.length;
                keyDocumentMap = new Map(results.map(d => [d._id, d]));
            } else {
                runAction(action, queryParams, changeEvent, results, keyDocumentMap);
            }
            return results;
        }
    };
    return strategy;
}

function resultWindowBufferStrategy(queryParams: QueryParams<Human>, bufferSize: number, table: MemoryTable): Strategy {
    const resultWindowBuffer: ResultWindowBuffer<Human> = createResultWindowBuffer(queryParams, {
        limitBufferSize: bufferSize,
        skipBufferSize: bufferSize
    });
    const bufferQuery = getResultWindowBufferQuery(resultWindowBuffer);
    resetResultWindowBuffer(resultWindowBuffer, table.query(queryParams, bufferQuery.limit, bufferQuery.skip));
    const strategy: Strategy = {
        name: 'result window buffer, bufferSize ' + bufferSize,
        fullQueries: 0,
        time: 0,
        rowsRead: 0,
        wrongResults: 0,
        update(changeEvent, t) {
            if (applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent) === 'runFullQueryAgain') {
                strategy.fullQueries++;
                const rows = t.query(queryParams, bufferQuery.limit, bufferQuery.skip);
                strategy.rowsRead += rows.length;
                resetResultWindowBuffer(resultWindowBuffer, rows);
            }
            return getResultWindowBufferResults(resultWindowBuffer);
        }
    };
    return strategy;
}

function runBenchmark(query: TestQuery, mix: EventMix) {
    const generator = new EventGenerator(SEED);
    const table = new MemoryTable();
    for (let i = 0; i < ROWS; i++) {
        const doc = generator.randomHuman();
        table.applyChangeEvent({ operation: 'INSERT', id: doc._id, doc, previous: null });
    }
    const queryParams = getTestQueryParams(query);

    const fullQueryEachTime: Strategy = {
        name: 'full query each time',
        fullQueries: 0,
        time: 0,
        rowsRead: 0,
        wrongResults: 0,
        update(_changeEvent, t) {
            fullQueryEachTime.fullQueries++;
            const rows = t.query(queryParams);
            fullQueryEachTime.rowsRead += rows.length;
            return rows;
        }
    };
    const strategies: Strategy[] = [
        fullQueryEachTime,
        eventReduceStrategy(queryParams, table),
        ...BUFFER_SIZES.map(bufferSize => resultWindowBufferStrategy(queryParams, bufferSize, table))
    ];

    /**
     * For the plain EventReduce strategy, count the full queries where the new result
     * contains a row that was neither in the old result nor the changed row.
     * Such a row comes from behind the window or (with skip) from in front of it,
     * and no EventReduce action can know it.
     */
    let previousTruth = table.query(queryParams);
    const needsUnknownRow = { behind: 0, inFront: 0 };

    for (let i = 0; i < EVENTS; i++) {
        let changeEvent: ChangeEvent<Human>;
        if (mix === 'visible' && previousTruth.length > 0 && generator.random() < 0.4) {
            const previous = previousTruth[generator.int(0, previousTruth.length - 1)];
            if (generator.random() < WEIGHTS.update / (WEIGHTS.update + WEIGHTS.delete)) {
                const doc: Human = { ...previous };
                const field = generator.int(1, 3);
                if (field === 1) {
                    doc.name = 'name-' + generator.int(0, 1000);
                } else if (field === 2) {
                    doc.gender = doc.gender === 'f' ? 'm' : 'f';
                } else {
                    doc.age = generator.int(1, 100);
                }
                changeEvent = { operation: 'UPDATE', id: doc._id, doc, previous };
            } else {
                changeEvent = { operation: 'DELETE', id: previous._id, doc: null, previous };
            }
        } else {
            changeEvent = generator.randomChangeEvent(table, WEIGHTS);
        }
        table.applyChangeEvent(changeEvent);

        const truth = table.query(queryParams);
        const truthIds = idsOf(truth);

        const eventReduceFullQueriesBefore = strategies[1].fullQueries;
        for (const strategy of strategies) {
            const start = performance.now();
            const result = strategy.update(changeEvent, table);
            strategy.time += performance.now() - start;
            if (idsOf(result) !== truthIds) {
                strategy.wrongResults++;
            }
        }

        if (strategies[1].fullQueries > eventReduceFullQueriesBefore) {
            const previousIds = new Set(previousTruth.map(d => d._id));
            const unknown = truth.filter(d => !previousIds.has(d._id) && d._id !== changeEvent.id);
            if (unknown.length > 0) {
                const firstOfPrevious = previousTruth[0];
                if (firstOfPrevious && queryParams.sortComparator(unknown[0], firstOfPrevious) < 0) {
                    needsUnknownRow.inFront++;
                } else {
                    needsUnknownRow.behind++;
                }
            }
        }
        previousTruth = truth;
    }
    return { strategies, needsUnknownRow };
}

function queryLabel(query: TestQuery) {
    return [
        query.skip ? 'skip ' + query.skip : '',
        query.limit ? 'limit ' + query.limit : ''
    ].filter(Boolean).join(' + ');
}

function main() {
    // warm up the JIT, so the first measured run is not slower
    runBenchmark({ sortDirection: 'asc', limit: 10 }, 'visible');

    for (const mix of ['uniform', 'visible'] as EventMix[]) {
        console.log('');
        console.log('### ' + mix + ' events (' + ROWS + ' rows, ' + EVENTS + ' events, seed ' + SEED + ')');
        console.log('');
        console.log('| Query | Strategy | Full queries | Share | Time (ms) | Rows read | Wrong results |');
        console.log('|---|---|---:|---:|---:|---:|---:|');
        for (const query of QUERIES) {
            const { strategies, needsUnknownRow } = runBenchmark(query, mix);
            for (const strategy of strategies) {
                console.log('| ' + [
                    queryLabel(query),
                    strategy.name,
                    strategy.fullQueries,
                    (strategy.fullQueries / EVENTS * 100).toFixed(2) + ' %',
                    strategy.time.toFixed(0),
                    strategy.rowsRead,
                    strategy.wrongResults
                ].join(' | ') + ' |');
            }
            const eventReduce = strategies[1];
            console.error(
                '# ' + mix + ', ' + queryLabel(query) + ': EventReduce ran ' + eventReduce.fullQueries + ' full queries, ' +
                needsUnknownRow.behind + ' of them needed a row from behind the window, ' +
                needsUnknownRow.inFront + ' a row from in front of the window'
            );
        }
    }
}

main();
