# EventReduce JavaScript Implementation

This is the JavaScript implementation of the [EventReduce algorithm](https://github.com/pubkey/event-reduce): update live query results from database change events without re-running the query.

## What is EventReduce?

EventReduce is an algorithm to optimize database queries that run multiple times.
When you observe the results of a query, every write to the database can change them.
The simple solution is to run the full query again after each write, which costs disk-IO and time.
EventReduce instead takes the write event and the previous results of the query and calculates the new results on the CPU, without touching the database.

1. You run a query and get its results.
2. A write event (insert, update or delete) changes some data.
3. EventReduce gets the event and the previous results and tells you what to do with the results, for example `insertFirst`, `removeExisting` or `insertAtSortPosition`.
   Only when that is not possible, it tells you to run the query again (`runFullQueryAgain`).

To decide this quickly, EventReduce describes the event and the previous results with 18 boolean state functions like `isInsert()`, `wasResultsEmpty()` or `sortParamsChanged()`.
A [binary decision diagram](https://github.com/pubkey/binary-decision-diagram) that was created from the truth table of all state combinations and optimized for the fewest and cheapest calls,
then picks one of 16 action functions that changes the results exactly like the database would.

In the [browser demo](https://pubkey.github.io/event-reduce/), about **94%** of randomly generated events could be optimized this way,
and new query results are displayed up to **12 times** faster after a write.

EventReduce works with any database and query language, as long as you can tell it which documents match the query and how they are sorted.
The sort order must be [predictable](https://stackoverflow.com/a/11599283), which you get by adding the primary key as the last sort field.

## Where is it used?

- [RxDB](https://rxdb.info/), the local-first JavaScript database, uses EventReduce for its realtime queries since [version 9.0.0](https://rxdb.info/releases/9.0.0.html).
  When you subscribe to a query in RxDB, writes to the collection update the results with EventReduce instead of running the query again.
- It is a good fit wherever query results are observed or cached:
  - reduce the latency until a change to the database updates your application
  - make observing query results more scalable by doing less disk-IO
  - reduce the bandwidth when streaming realtime query results from the backend to the client
  - update a query cache on writes instead of invalidating it

## Installation

```bash
npm install event-reduce-js
```

## Usage

In the following we will use EventReduce together with minimongo as an example. You can apply the code to any other database.

1. First you need some `QueryParams` that can be used by EventReduce to analyze result-event combinations.

```typescript
import {
    getSortFieldsOfQuery,
    ChangeEvent,
    calculateActionName,
    StateResolveFunctionInput,
    runAction
} from 'event-reduce-js';

// some stuff must not be coded by hand but is already in the minimongo library
import {
    compileDocumentSelector,
    compileSort
} from 'minimongo/src/selector';

// create this helper function that can be used for all queries
export function getQueryParamsByMongoQuery(query: MongoQuery): QueryParams<any> {
    const sort = query.sort ? query.sort : ['_id'];
    return {
        // primary key of the documents
        primaryKey: '_id',
        // (optional) a function that returns the id of a document,
        // for ids that are not stored in a single top-level field,
        // like compound or nested primary keys. Overrides primaryKey.
        // getDocumentId: doc => doc.key.team + '|' + doc.key.num,
        // a string[] with all fields that are used in the sorting
        sortFields: getSortFieldsOfQuery(query),
        skip: query.skip ? query.skip : undefined,
        limit: query.limit ? query.limit : undefined,
        // a function that returns true if the given document matches the query's selector
        queryMatcher: compileDocumentSelector(query.selector),
        // a function that can be used as comparator in Array.sort() (returns 1 or -1)
        sortComparator: compileSort(sort)
    };
}

const exampleQuery: MongoQuery = {
    selector: {
        age: {
            $gt: 18
        },
        gender: 'm'
    },
    limit: 10,
    sort: ['name', '_id']
};

const queryParams = getQueryParamsByMongoQuery(exampleQuery);

```


2. Now lets say you have an `changeEvent` from whatever changestream or observable your database provides. You also have the `currentResults` of the query.

```typescript

// build the input
const input: StateResolveFunctionInput<DocumentType> = {
    // the changeEvent
    changeEvent,
    // queryParams from above
    queryParams,
    // array with previous results documents
    previousResults: currentResults,
    // key->document map with previous results indexed by primary key
    // (optional) improves performance
    keyDocumentMap: currentDocMap
};

// calculate the correct action name
const action = calculateActionName(input);

if (action === 'runFullQueryAgain') {
    /**
     * when EventReduce could not optimize the input,
     * we get the actionName 'runFullQueryAgain'
     * and run the query over the database again
     */
    currentResults = await implementation.getRawResults(query);
    // also refresh the key-document map
    currentDocMap.clear();
    currentResults.forEach(doc => currentDocMap.set(doc._id, doc));
} else {
    // event-reduce could optimize the event, run the action function
    runAction(
        action,
        queryParams,
        changeEvent,
        currentResults,
        currentDocMap
    );
}

// show new results
// notice that for performance resons,
// the functions of event-reduce will mutate the input variables
console.dir(currentResults);
```

## Smaller bundles

`calculateActionName()` and `runAction()` work with action names, so the names of all actions end up in your bundle. If bundle size matters, use `calculateActionFunction()` instead. It returns the action function directly:

```typescript
import { calculateActionFunction, runFullQueryAgain } from 'event-reduce-js';

const action = calculateActionFunction(input);
if (action === runFullQueryAgain) {
    // run the query over the database again
} else {
    action(input); // mutates input.previousResults
}
```

## Additional Optimization: Result Window Buffer

For a query with a limit or a skip, EventReduce returns `runFullQueryAgain` when a row has to move into the result window that is not in the previous results:
the row after the window (when a row leaves a full window) or the last skipped row (when a row is added in front of the window).
The result window buffer avoids most of these full queries: it keeps `limitBufferSize` rows after the window and `skipBufferSize` skipped rows before it in memory.

```typescript
import {
    createResultWindowBuffer,
    applyChangeEventsToResultWindowBuffer,
    getRecommendedResultWindowBufferSize,
    getResultWindowBufferQuery,
    getResultWindowBufferResults,
    resetResultWindowBuffer
} from 'event-reduce-js';

// recommended size: about log2(limit), at most 30, see the docs link below
const size = getRecommendedResultWindowBufferSize(queryParams.limit);
const resultWindowBuffer = createResultWindowBuffer(queryParams, { limitBufferSize: size, skipBufferSize: size });
// run the query with the skip and limit of the buffer
resetResultWindowBuffer(resultWindowBuffer, await runQuery(getResultWindowBufferQuery(resultWindowBuffer, query)));
let results = getResultWindowBufferResults(resultWindowBuffer); // the rows of the original skip and limit

// on new change events
const result = applyChangeEventsToResultWindowBuffer(resultWindowBuffer, changeEvents);
if (result.runFullQueryAgain) {
    resetResultWindowBuffer(resultWindowBuffer, await runQuery(getResultWindowBufferQuery(resultWindowBuffer, query)));
    results = getResultWindowBufferResults(resultWindowBuffer);
} else if (result.changed) {
    results = result.results;
}
```

See [Result window buffer](https://github.com/pubkey/event-reduce/blob/master/docs/result-window-buffer.md) for how it works, how to choose the buffer sizes and measurements.

## Error codes

To keep the bundle small, errors only contain a short code:

| Code | Meaning |
| --- | --- |
| `EventReduce:RUN_FULL` | The `runFullQueryAgain` action was called. You have to re-run the query yourself. |
| `EventReduce:UNK_ACT` | The `unknownAction` action was called, or `runAction()` was called with `alwaysWrong`. This should never happen. |
| `EventReduce:RWB_SIZE` | `createResultWindowBuffer()` got a buffer size that is negative or not a number, like `NaN`. |
| `EventReduce:RWB_OUTDATED` | `getResultWindowBufferResults()` was called while the result window is not in the buffer: before `resetResultWindowBuffer()`, or after `applyChangeEventToResultWindowBuffer()` returned `'runFullQueryAgain'` and the query did not run again. |
| `EventReduce:UNK_STATE` | `resolveState()` was called with an unknown state name. |
| `EventReduce:FALSY` | `ensureNotFalsy()` got a falsy value. |
