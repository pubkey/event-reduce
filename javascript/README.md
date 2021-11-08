# EventReduce JavaScript Implementation

This is the javascript version of the [EventReduce algorithm](https://github.com/pubkey/event-reduce).


## Installation

`npm run install event-reduce-js --save`

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
