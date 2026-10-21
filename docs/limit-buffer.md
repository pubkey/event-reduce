# Limit buffer

The limit buffer is a usage pattern on top of EventReduce, not a feature of the `event-reduce-js` package.
For a query with a limit, you keep more rows in memory than the limit and show only the first `limit` of them.
When a visible row leaves the window, the next row comes from memory instead of a new query.

- Helper code: [`examples/browser/src/limit-buffer.ts`](../examples/browser/src/limit-buffer.ts)
- Randomized test: [`examples/browser/test/limit-buffer.test.ts`](../examples/browser/test/limit-buffer.test.ts)
- Benchmark: [`examples/browser/test/limit-buffer.benchmark.ts`](../examples/browser/test/limit-buffer.benchmark.ts)
- Demo: the "Limit buffer" section of the [browser demo](https://pubkey.github.io/event-reduce/)

![Limit buffer section of the browser demo](./files/limit-buffer-demo.png)

## The problem

EventReduce calculates the new result of a query from the old result and a change event.
For a query with a limit, the old result holds only the rows inside the window.
When a row leaves a full window, the next row after the window has to move up,
but that row was never part of the old result. No EventReduce action can know it,
so EventReduce returns `runFullQueryAgain`. This happens when:

- a row of a full window is deleted;
- a row moves behind the last row (an update of a sort field);
- a row stops matching the query.

We measured how often this is the reason for a full query
(10,000 rows, 5,000 seeded events, query `gender === 'f'` sorted by `age, _id`, see the [benchmark](#measurements)):

| Event mix | Query | Full queries with EventReduce | of them: next row after the window unknown |
|---|---|---:|---:|
| uniform | limit 20 | 4 | 4 (100 %) |
| uniform | limit 100 | 25 | 25 (100 %) |
| uniform | skip 20 + limit 20 | 17 | 11 (65 %) |
| visible | limit 20 | 1,429 | 1,429 (100 %) |
| visible | limit 100 | 1,436 | 1,436 (100 %) |
| visible | skip 20 + limit 20 | 1,502 | 1,431 (95 %) |

With these event mixes, nearly every full query of a limited query happens because the next row is unknown.
The other full queries with skip come from changes in front of the window, where a row from the skipped part moves into the window.
The exact share depends on your writes, for example how often rows are inserted in front of a skip window.

## How the pattern works

1. Run the query with `limit + bufferSize` (same selector, sort and skip) and keep the rows as the **buffer**.
2. The visible result is `buffer.slice(0, limit)`.
3. On each change event, update the buffer instead of the visible result.
4. Run the query again only when the buffer gets shorter than `limit` while more rows may exist,
   or when a change cannot be applied without breaking the invariant.

### The invariant

> The buffer is always an exact prefix of the true sorted result (after the skip).

The buffer may get shorter than `limit + bufferSize`, but it never contains a wrong row and never misses a row in between.
Because it is a prefix, its first `limit` rows are always the correct visible result.

Rows after the last row of the buffer are unknown. So a changed row that now sorts after the last row
is **not** appended; it is left out and the buffer gets one row shorter.
The exception is a **complete** buffer: if the query returned fewer rows than requested,
the buffer holds the whole result, and rows can be appended at its end.

### How EventReduce is used

The helper runs two steps for each change event.

**Step 1: EventReduce on the buffer.** A prefix of length `n` is exactly the result of the same query with `limit: n`.
So the helper calls `calculateActionName()` with `queryParams.limit` set to `buffer.length`,
and EventReduce works on the buffer like on any other query result.
If the buffer is complete, the helper uses `buffer.length + 1`.
Then EventReduce knows that the limit is not reached and that no more rows exist,
so it can, for example, append an inserted row at the end.
If EventReduce returns an action, the helper runs it with `runAction()`. The new buffer is the exact result for that limit, so it is still a prefix.

**Step 2: the prefix rule, when EventReduce returns `runFullQueryAgain`.**
EventReduce has to keep the length `n` of the result, and for that it needs the next row.
The buffer does not have to keep its length; it only has to stay a prefix.
This rule does that:

> All matching rows that sort between the first and the last row of the buffer are in the buffer.

This is still true after a change event, if you compare with the *old* first and last rows.
So the new buffer is the old buffer without the old version of the changed row,
plus the new version if it matches and sorts between the old first and last row (or anywhere, if the buffer is complete).
A row that sorts after the last row is left out, so the buffer shrinks.

With `skip`, exactly `skip` rows sort before the first row of the buffer:

- If one of them leaves (deleted, no longer matching, or moved into or behind the buffer), every row moves one position up.
  The first row of the buffer moves into the skipped part, so the helper removes it.
- If a row is added in front, the last skipped row moves into the window. That row is unknown, so the query must run again.

**The prefix rule also lets the buffer grow again.** EventReduce keeps the length, so when a row comes into a full result,
it drops the last row (`insertAtSortPositionRemoveLast` and the other `removeLast…` actions).
If the buffer has shrunk below `limit + bufferSize`, that row does not have to be dropped:
the prefix rule keeps it, and the buffer gets one row longer.
So for these actions the helper uses the prefix rule instead, as long as the buffer is not full.
In the benchmark, this saved 5 to 11 % of the full queries compared to always running the action of EventReduce.

**Step 3:** if the buffer is longer than `limit + bufferSize`, the helper cuts its end and marks it as not complete.
If it is not complete and shorter than `limit`, the helper returns `runFullQueryAgain`.

You could use the prefix rule alone, because it can handle every event that EventReduce handles.
We tried that: it needed the same number of full queries, but took 2 to 8 times as long in the uniform mix, where most events do not touch the window,
because it compares the changed row with the first and last row of the buffer, while the EventReduce decision diagram
often answers `doNothing` after a few checks.
So the helper keeps EventReduce in front. Its actions are verified by the EventReduce fuzzing, and the prefix rule only handles the rest.
For `bufferSize: 0`, the helper behaves like plain EventReduce (see the table below).

### Requirements

- The sort order must be deterministic. Rows with the same sort values must be ordered by the primary key.
  The helper breaks ties with the primary key when the comparator returns `0`, and the database must sort the same way.
- Every write must reach the buffer as a change event, in order, with `previous` set for updates and deletes.
  These are the same requirements as for EventReduce itself.

## The code

Copy [`examples/browser/src/limit-buffer.ts`](../examples/browser/src/limit-buffer.ts) into your project. It only depends on `event-reduce-js`.

```ts
import {
    createLimitBuffer,
    applyChangeEventToLimitBuffer,
    getLimitBufferQueryLimit,
    getLimitBufferResults,
    resetLimitBuffer
} from './limit-buffer';

// queryParams as for EventReduce, with the limit that the user sees, for example 20
const bufferSize = 20;
const limitBuffer = createLimitBuffer(
    queryParams,
    bufferSize,
    await db.find({ ...query, limit: query.limit + bufferSize })
);
render(getLimitBufferResults(limitBuffer));

db.changes$.subscribe(async changeEvent => {
    const result = applyChangeEventToLimitBuffer(limitBuffer, changeEvent);
    if (result === 'runFullQueryAgain') {
        const rows = await db.find({ ...query, limit: getLimitBufferQueryLimit(limitBuffer) });
        resetLimitBuffer(limitBuffer, rows);
    }
    render(getLimitBufferResults(limitBuffer));
});
```

`applyChangeEventToLimitBuffer()` returns `'eventReduce'` (step 1 handled the event), `'buffer'` (the prefix rule handled it)
or `'runFullQueryAgain'`. This is the core of it:

```ts
export function applyChangeEventToLimitBuffer<DocType>(
    limitBuffer: LimitBuffer<DocType>,
    changeEvent: ChangeEvent<DocType>
): LimitBufferResult {
    const buffer = limitBuffer.buffer;
    if (!limitBuffer.complete && buffer.length === 0) {
        return 'runFullQueryAgain';
    }
    // 1. EventReduce, with the buffer length as limit
    const queryParams = {
        ...limitBuffer.queryParams,
        limit: limitBuffer.complete ? buffer.length + 1 : buffer.length
    };
    const action = calculateActionName({
        queryParams,
        changeEvent,
        previousResults: buffer,
        keyDocumentMap: limitBuffer.keyDocumentMap
    });
    let result: LimitBufferResult;
    if (action === 'runFullQueryAgain') {
        // 2. let the buffer shrink instead of asking for the next row
        if (!applyPrefixRule(limitBuffer, changeEvent)) {
            return 'runFullQueryAgain';
        }
        result = 'buffer';
    } else if (
        ACTIONS_THAT_DROP_THE_LAST_ROW.has(action) &&
        buffer.length < getLimitBufferQueryLimit(limitBuffer) &&
        applyPrefixRule(limitBuffer, changeEvent)
    ) {
        // keep the last row and let the buffer grow again
        result = 'buffer';
    } else {
        runAction(action, queryParams, changeEvent, buffer, limitBuffer.keyDocumentMap);
        result = 'eventReduce';
    }
    // 3. cut the end, and run the query when the visible window cannot be filled
    const maxLength = getLimitBufferQueryLimit(limitBuffer);
    while (buffer.length > maxLength) {
        const removed = buffer.pop();
        limitBuffer.keyDocumentMap.delete(getDocumentId(limitBuffer.queryParams, removed));
        limitBuffer.complete = false;
    }
    if (!limitBuffer.complete && buffer.length < limitBuffer.queryParams.limit) {
        return 'runFullQueryAgain';
    }
    return result;
}
```

See the [source file](../examples/browser/src/limit-buffer.ts) for `applyPrefixRule()` and the other functions.

### Proof by test

[`limit-buffer.test.ts`](../examples/browser/test/limit-buffer.test.ts) runs seeded random inserts, updates
(including changes of the sort field and of the matching field) and deletes.
The queries use a limit, skip + limit, and ascending and descending sort, with `bufferSize` 0, 5, 20 and 50,
and start with 0, 30 or 300 rows, so the result grows, moves and shrinks to nothing.
After **every** event the test checks that:

- the visible result equals the full query;
- the buffer equals the first `buffer.length` rows of the full result;
- a complete buffer holds all rows of the full result.

It runs 72 combinations with 1,500 events each. If you break any part of the prefix rule, the test fails.
Run it with `npm run test:unit` in `examples/browser`.

## Choosing `bufferSize`

Each row that leaves the window makes the buffer one row shorter.
A full query is needed after about `bufferSize + 1` rows have left.
So the number of full queries is at most about `(rows that leave the window) / (bufferSize + 1)`.
Rows that come in in front of the last row make the buffer longer again, so the real number is a bit lower.
In the benchmark: 1,429 full queries for `bufferSize: 0`, then 220 (÷ 6.5), 62 (÷ 23) and 25 (÷ 57).

- Start with `bufferSize` about equal to `limit`.
  This removes most full queries, and each query reads at most twice as many rows.
- Use a bigger buffer when many rows leave the window between two inserts that refill it,
  for example a list where users often delete or move what they see.
- The gain gets smaller as the buffer grows, while memory and the rows read per full query keep growing.
- If you know how many rows leave the window between two moments where a query is acceptable, use that number.

## Trade-offs

- **More rows per full query.** Each query reads `limit + bufferSize` rows instead of `limit`.
  This matters for databases with an index on the sort fields, where the cost grows with the rows read.
  For an unindexed query that filters and sorts everything (like the in-memory table of the benchmark), the extra rows cost almost nothing.
  The total rows read still went down in all our measurements, because there are fewer queries.
- **More memory.** You hold `limit + bufferSize` rows per query.
- **No limit, no gain.** Without a limit, EventReduce never needs the next row, so a buffer cannot help.
- **Changes in front of a skip window.** When a row is added in front of the window,
  the row that moves into the window is a skipped row, which the buffer does not hold.
  The query must run again. If most changes happen in front of the window, the buffer helps little.
  In the benchmark, skip 20 + limit 20 still needs 75 full queries with `bufferSize: 50`, compared to 25 without skip.
- **The buffer fills up only partly by itself.** A row that comes in in front of the last row makes the buffer longer again.
  But rows that sort after the last row are unknown, so a buffer that lost many rows from its end stays short until the next full query.

## Measurements

10,000 rows, 5,000 events (1 insert : 3 updates : 1 delete), seed 2026, query `gender === 'f'`, sorted by `age` then `_id`,
Node.js 22 on 4 CPU cores. A full query filters and sorts the whole in-memory table (about 1.8 ms each).
Time is the time spent to keep the result up to date, including the full queries, without the writes.
All strategies were checked against a full query after every event: there were 0 wrong results.

**Visible events:** 40 % of the events update or delete a row of the current visible result, like a user who edits what they see.
The rest are random events on any row.

| Query | Strategy | Full queries | Share | Time | Rows read |
|---|---|---:|---:|---:|---:|
| limit 20 | full query each time | 5,000 | 100 % | 8,899 ms | 100,000 |
| limit 20 | EventReduce | 1,429 | 28.58 % | 2,579 ms | 28,580 |
| limit 20 | bufferSize 0 | 1,429 | 28.58 % | 2,633 ms | 28,580 |
| limit 20 | bufferSize 5 | 220 | 4.40 % | 422 ms | 5,500 |
| limit 20 | bufferSize 20 | 62 | 1.24 % | 129 ms | 2,480 |
| limit 20 | bufferSize 50 | 25 | 0.50 % | 59 ms | 1,750 |
| limit 100 | full query each time | 5,000 | 100 % | 8,883 ms | 500,000 |
| limit 100 | EventReduce | 1,436 | 28.72 % | 2,618 ms | 143,600 |
| limit 100 | bufferSize 0 | 1,436 | 28.72 % | 2,621 ms | 143,600 |
| limit 100 | bufferSize 5 | 220 | 4.40 % | 432 ms | 23,100 |
| limit 100 | bufferSize 20 | 61 | 1.22 % | 124 ms | 7,320 |
| limit 100 | bufferSize 50 | 25 | 0.50 % | 57 ms | 3,750 |
| skip 20 + limit 20 | full query each time | 5,000 | 100 % | 9,186 ms | 100,000 |
| skip 20 + limit 20 | EventReduce | 1,502 | 30.04 % | 2,857 ms | 30,040 |
| skip 20 + limit 20 | bufferSize 0 | 1,501 | 30.02 % | 2,837 ms | 30,020 |
| skip 20 + limit 20 | bufferSize 5 | 267 | 5.34 % | 549 ms | 6,675 |
| skip 20 + limit 20 | bufferSize 20 | 102 | 2.04 % | 205 ms | 4,080 |
| skip 20 + limit 20 | bufferSize 50 | 75 | 1.50 % | 154 ms | 5,250 |

**Uniform events:** every row is equally likely to change. With 10,000 rows, few events touch the first 20 or 100 rows,
so EventReduce alone already needs very few full queries. The buffer still removes most of the rest.

| Query | Strategy | Full queries | Share | Time | Rows read |
|---|---|---:|---:|---:|---:|
| limit 20 | full query each time | 5,000 | 100 % | 9,793 ms | 100,000 |
| limit 20 | EventReduce | 4 | 0.08 % | 37 ms | 80 |
| limit 20 | bufferSize 0 | 4 | 0.08 % | 23 ms | 80 |
| limit 20 | bufferSize 5 | 0 | 0 % | 6 ms | 0 |
| limit 20 | bufferSize 20 | 0 | 0 % | 7 ms | 0 |
| limit 20 | bufferSize 50 | 0 | 0 % | 6 ms | 0 |
| limit 100 | full query each time | 5,000 | 100 % | 10,206 ms | 500,000 |
| limit 100 | EventReduce | 25 | 0.50 % | 83 ms | 2,500 |
| limit 100 | bufferSize 0 | 25 | 0.50 % | 72 ms | 2,500 |
| limit 100 | bufferSize 5 | 2 | 0.04 % | 13 ms | 210 |
| limit 100 | bufferSize 20 | 0 | 0 % | 11 ms | 0 |
| limit 100 | bufferSize 50 | 0 | 0 % | 9 ms | 0 |
| skip 20 + limit 20 | full query each time | 5,000 | 100 % | 9,989 ms | 100,000 |
| skip 20 + limit 20 | EventReduce | 17 | 0.34 % | 83 ms | 340 |
| skip 20 + limit 20 | bufferSize 0 | 17 | 0.34 % | 53 ms | 340 |
| skip 20 + limit 20 | bufferSize 5 | 6 | 0.12 % | 18 ms | 150 |
| skip 20 + limit 20 | bufferSize 20 | 6 | 0.12 % | 18 ms | 240 |
| skip 20 + limit 20 | bufferSize 50 | 6 | 0.12 % | 18 ms | 420 |

The times are dominated by the full queries, so a database where queries are slower (for example IndexedDB) gains more.
Run the benchmark with `npm run benchmark:limit-buffer` in `examples/browser`.
