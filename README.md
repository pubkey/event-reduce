<br/>

<h1 align="center">Event-Reduce Algorithm</h1>
<p align="center">
  <strong>Update live query results from change events without re-running the query</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/event-reduce-js"><img src="https://img.shields.io/npm/v/event-reduce-js.svg" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/event-reduce-js"><img src="https://img.shields.io/npm/dm/event-reduce-js.svg" alt="npm downloads" /></a>
  <a href="https://github.com/pubkey/event-reduce/actions/workflows/main.yml"><img src="https://github.com/pubkey/event-reduce/actions/workflows/main.yml/badge.svg" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license" /></a>
</p>

<p align="center">
  <a href="https://pubkey.github.io/event-reduce/">Live demo</a> ·
  <a href="./javascript/">JavaScript implementation</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#faq">FAQ</a>
</p>

<br/>

* * *

<br/>

EventReduce is an algorithm for **live queries** (also called reactive or realtime queries). When a document is inserted, updated or deleted, it takes the old query results and the change event and computes the new results **in memory, without querying the database again**. It works like a lightweight form of **incremental view maintenance** for a single query over a single table or collection.

- **~94% of write events** in the [browser demo](https://pubkey.github.io/event-reduce/) are handled without re-running the query
- **Up to 12× faster** delivery of new query results after a write
- **Works with any database** that gives you a change stream: MongoDB, PostgreSQL, MySQL, IndexedDB, SQLite, in-memory stores...
- **Proven in production** as the query engine behind the live queries of [RxDB](https://rxdb.info/)

## Quickstart

```bash
npm install event-reduce-js
```

```javascript
import { calculateActionName, runAction } from 'event-reduce-js';

// describe your query: SELECT * FROM users WHERE age > 18 ORDER BY age, id LIMIT 10
const queryParams = {
    primaryKey: 'id',
    sortFields: ['age', 'id'],
    limit: 10,
    queryMatcher: doc => doc.age > 18,
    sortComparator: (a, b) => (a.age - b.age || (a.id < b.id ? -1 : 1)) < 0 ? -1 : 1
};

let results = [{ id: 'a', age: 20 }, { id: 'b', age: 30 }];

// a change event from your database's change stream
const changeEvent = { operation: 'INSERT', id: 'c', doc: { id: 'c', age: 25 }, previous: null };

const action = calculateActionName({ queryParams, changeEvent, previousResults: results });
if (action === 'runFullQueryAgain') {
    results = await runQueryOnDatabase(); // EventReduce could not optimize this event
} else {
    results = runAction(action, queryParams, changeEvent, results);
    // -> [{ id: 'a', age: 20 }, { id: 'c', age: 25 }, { id: 'b', age: 30 }]
}
```

See the [JavaScript implementation](./javascript/) for the full API and a MongoDB-style example.

## The problem


<ul>
    <li>1. You make a query to the database which returns the result in 100 milliseconds</li>
    <li>2. A write event occurs on the database and changes some data</li>
    <li>3. To get the new version of the query's results you now have three options:</li>
    <ul>
        <li>a. Run the query over the database again which takes another 100 milliseconds</li>
        <li>
            b. Write complex code that somehow merges the incoming event with the old state
        </li>
        <li>
            c. Use <b>Event-Reduce</b> to calculate the new results on the CPU without disc-IO <b>nearly instant</b>
        </li>
    </ul>
</ul>

<br/>



<p align="center">
    <img src="./orga/event-reduce.png" width="100%" />
</p>

<br/>

## Efficiency

In the [browser demo](https://pubkey.github.io/event-reduce/) you can see that for randomly generated events, about **94%** of them could be optimized by EventReduce. In real world usage, with non-random events, this can be even higher. For the different implementations in common browser databases, we can observe an up to **12 times** faster displaying of new query results after a write occurred.

## How it works

EventReduce uses 18 different `state functions` to 'describe' an event+previousResults combination. A state function is a function that returns a boolean value like `isInsert()`, `wasResultsEmpty()`, `sortParamsChanged()` and so on.

Also there are 16 different `action functions`. An action function gets the event+previousResults and modifies the results array in a given way like `insertFirst()`, `replaceExisting()`, `insertAtSortPosition()`, `doNothing()` and so on.

For each of our `2^19` state combinations, we calculate which action function gives the same results that the database would return when the full query is executed again.

From this state-action combinations we create a big truth table that is used to create a [binary decision diagram](https://github.com/pubkey/binary-decision-diagram). The BDD is then optimized to call as few `state functions` as possible to determine the correct action of an incoming event-results combination.

The resulting optimized BDD is then shipped as the EventReduce algorithm and can be used in different programming languages and implementations. The programmer does not need to know about all this optimisation stuff and can directly use three simple functions like shown in the [JavaScript implementation](https://github.com/pubkey/event-reduce/tree/master/javascript)

## When to use this

Use EventReduce whenever you observe query results and need to keep them up to date, for example for reactive UIs, realtime dashboards, live queries in local-first apps or server-push subscriptions. You can use it to

* reduce the latency until a change to the database updates your application
* make observing query results more scalable by doing less disk-io
* reduce the bandwith when streaming realtime query results from the backend to the client
* create a better form of caching where instead of invalidating the cache on write, you update its content

## Limitations

- EventReduce only works with queries that have a [predictable](https://stackoverflow.com/a/11599283) sort-order for any given documents. (you can make any query predicable by adding the primary key as last sort parameter)

- EventReduce can be used with relational databases but not on relational queries that run over multiple tables/collections. (you can use views as workarround so that you can query over only one table). In theory Event-Reduce could also be used for relational queries but I did not need this for now. Also the fuzzing that ensures the correctness of the truth table runs for a long time, and having more state functions looks like an NP problem.

## Implementations

At the moment there is only the [JavaScript implementation](./javascript/) that you can use over npm. Pull requests for other languages are welcomed.

## Previous Work

- Meteor uses a feature called [OplogDriver](https://github.com/meteor/docs/blob/master/long-form/oplog-observe-driver.md) that is limited on queries that do not use `skip` or `sort`. Also watch [this video](https://www.youtube.com/watch?v=_dzX_LEbZyI) to learn how OpLogDriver works.

- [RxDB](https://rxdb.info/) used the `QueryChangeDetection` which works by many handwritten if-else comparisons. RxDB switched to EventReduce since version [9.0.0](https://rxdb.info/releases/9.0.0.html).

- Baqend is [creating a database](https://vsis-www.informatik.uni-hamburg.de/getDoc.php/publications/620/invalidb_4-pages.pdf) that optimizes for realtime queries. Watch the video [Real-Time Databases Explained: Why Meteor, RethinkDB, Parse & Firebase Don't Scale](https://www.youtube.com/watch?v=HiQgQ88AdYo) to learn more.


## FAQ

<details>
  <summary>Is this incremental view maintenance (IVM)?</summary>
  In a narrow sense, yes. EventReduce incrementally maintains the result of one query (filter, sort, skip, limit) over one table or collection. Unlike general IVM engines it needs no query planner or dataflow graph and does not run any work on writes. It is a pure function from <code>(old results, change event)</code> to <code>new results</code> that you call whenever you need fresh results.
</details>

<details>
  <summary>Is this something like materialized views?</summary>
  Yes and no. Materialized views solve a similar problem but in a different way with different trade-offs. When you have many users, all subscribing to <b>different queries</b>, you cannot create that many views because they are all recalculated on each write access to the database. EventReduce however has better scalability because it does not affect write performance and the calculation is done when the fresh query results are requested, not beforehand.
</details>

<details>
  <summary>Is this something like event sourcing or CQRS?</summary>
  No, event sourcing is mostly used to calculate a current state by attaching the full event stream to the starting state. This allows for stuff like time travel and so on. EventReduce solves a completely different (performance-) problem and only shares some common keywords like <b>event</b>.
</details>

<details>
  <summary>Isn't this optimization already done by database engines?</summary>
  No. I tested EventReduce with many common databases like MongoDB, MySQL and Postgres. Each of them had better performance with Event-Reduce than just observing the eventstream and running the queries again. If you understand what Event-Reduce exactly does, it becomes clear that this optimization cannot be done by pull-based databases because they have missing information.
</details>

<details>
  <summary>Isn't this the same as product XY?</summary>
  No. EventReduce is not a product, it is not comparable to any database or streaming backend out there. EventReduce is an algorithm with a specific input and output, nothing more, nothing less. You can use EventReduce without having to change your underlying data infrastructure.
</details>
