# Result window buffer

For a query with a limit or a skip, the result window buffer of `event-reduce-js` keeps some rows before and after the result window in memory.
When a row has to move into the window, it comes from memory instead of a new query.

- Source: [`javascript/src/result-window-buffer.ts`](../javascript/src/result-window-buffer.ts)
- Randomized test: [`javascript/test/unit/result-window-buffer.test.ts`](../javascript/test/unit/result-window-buffer.test.ts)
- Benchmark: [`examples/browser/test/result-window-buffer.benchmark.ts`](../examples/browser/test/result-window-buffer.benchmark.ts)
- Demo: the "Result window buffer" section of the [browser demo](https://pubkey.github.io/event-reduce/)

![Result window buffer section of the browser demo](./files/result-window-buffer-demo.png)

## The problem

EventReduce calculates the new result of a query from the old result and a change event.
For a query with a limit or a skip, the old result holds only the rows inside the window.
Some changes make a row move into the window that was never part of the old result.
No EventReduce action can know that row, so EventReduce returns `runFullQueryAgain`:

- **The row after the window**, when a row leaves a full window:
  it is deleted, it moves behind the last row, or it stops matching the query.
- **The last skipped row**, when a row is added in front of a skip window:
  every row moves one position back, and the last skipped row moves into the window.

We measured how often these are the reason for a full query
(10,000 rows, 5,000 seeded events, query `gender === 'f'` sorted by `age, _id`, see the [benchmark](#measurements)):

| Event mix | Query | Full queries with EventReduce | of them: row after the window unknown | of them: last skipped row unknown |
|---|---|---:|---:|---:|
| uniform | limit 20 | 4 | 4 | 0 |
| uniform | limit 100 | 25 | 25 | 0 |
| uniform | skip 20 + limit 20 | 17 | 11 | 6 |
| uniform | skip 20 | 6 | 0 | 6 |
| visible | limit 20 | 1,429 | 1,429 | 0 |
| visible | limit 100 | 1,436 | 1,436 | 0 |
| visible | skip 20 + limit 20 | 1,502 | 1,431 | 8 |
| visible | skip 20 | 7 | 0 | 7 |

With these event mixes, nearly every full query of a query with a limit or skip happens because one of these rows is unknown.

## How it works

The buffer is a slice of the full sorted result, that is, of the result without skip and limit.
It holds the result window, up to `skipBufferSize` rows before it (out of the skipped rows)
and up to `limitBufferSize` rows after it.

### The invariant

> The buffer is always an exact, contiguous slice of the full sorted result,
> and `offset`, the number of matching rows that sort before its first row, is known exactly.

The buffer never contains a wrong row and never misses a row in between.
It is **complete** if no rows exist after its last row,
because the query returned fewer rows than requested or because it has no limit.

The result window `[skip, skip + limit)` starts at position `skip - offset` inside the buffer.
As long as the window fits into the buffer, the visible result is the matching part of the buffer.
If the window does not fit anymore, the query must run again:

- `offset > skip`: the window starts before the buffer, because too many rows were added in front;
- the buffer is not complete and ends before the end of the window, because too many rows left it.

### The steps for each change event

**Step 1: EventReduce on the buffer.** An exact slice of length `n` with `offset` rows before it
is exactly the result of the same query with `skip: offset` and `limit: n`.
So the result window buffer runs the EventReduce decision diagram with these values,
and EventReduce works on the buffer like on any other query result.
If the buffer is complete, it uses `limit: n + 1`, so EventReduce knows that no more rows exist.
If EventReduce returns an action, the result window buffer runs it. The new buffer is the exact result for these values, so the invariant holds.
No new decision diagram is needed: the existing one only gets a different, but true, skip and limit.

**Step 2: the slice rule**, when EventReduce returns `runFullQueryAgain`,
or an action that would drop the first or the last row to keep the length of the result.
EventReduce has to keep the length `n`, and for that it needs a row it does not know.
The buffer does not have to keep its length; it only has to stay an exact slice.
This rule does that:

> All matching rows that sort between the first and the last row of the buffer are in the buffer,
> and exactly `offset` matching rows sort before its first row.

This is still true after a change event, if you compare with the *old* first and last rows. So:

- the old version of the changed row is removed from the buffer;
- the new version is added if it matches and sorts between the old first and last row;
- `offset` grows by one if the changed row now sorts before the old first row,
  and shrinks by one if it sorted there before.

So when a row leaves the window at the end, the buffer gets one row shorter at the end.
When a row is added in front, `offset` grows and the window moves one row towards the start of the buffer.
Two cases make the buffer grow instead:
if `offset` is 0, there are no rows before the first row, so a row that sorts before it is added at the start;
if the buffer is complete, there are no rows after the last row, so a row that sorts after it is added at the end.

**Step 3: trim.** Rows before the window beyond `skipBufferSize`
and rows after the window beyond `limitBufferSize` are removed. `offset` grows by the rows removed at the start.

**Step 4:** if the window does not fit into the buffer anymore, `applyChangeEventToResultWindowBuffer()` returns `runFullQueryAgain`.

You could use the slice rule alone, because it handles every event that EventReduce handles.
We tried that with the first version, which had only the buffer after the window:
it needed the same number of full queries, but took 2 to 8 times as long in the uniform mix, where most events do not touch the window.
The slice rule compares the changed row with the first and last row of the buffer, while the EventReduce decision diagram
often answers `doNothing` after a few checks.
So the result window buffer keeps EventReduce in front. Its actions are verified by the EventReduce fuzzing, and the slice rule only handles the rest.
With both buffer sizes at 0, the result window buffer behaves like plain EventReduce (see the tables below).

### Requirements

- The sort order must be deterministic. Rows with the same sort values must be ordered by the primary key.
  The result window buffer breaks ties with the primary key when the comparator returns `0`, and the database must sort the same way.
- Every write must reach the buffer as a change event, in order, with `previous` set for updates and deletes.
  These are the same requirements as for EventReduce itself.

## Usage

```ts
import {
    createResultWindowBuffer,
    applyChangeEventToResultWindowBuffer,
    getResultWindowBufferQuery,
    getResultWindowBufferResults,
    resetResultWindowBuffer
} from 'event-reduce-js';

// queryParams as for EventReduce, with the skip and limit that the user sees
const resultWindowBuffer = createResultWindowBuffer(queryParams, { limitBufferSize: 20, skipBufferSize: 20 });

async function runBufferQuery() {
    // the same query, with the skip and limit of the buffer
    const { skip, limit } = getResultWindowBufferQuery(resultWindowBuffer);
    resetResultWindowBuffer(resultWindowBuffer, await db.find({ ...query, skip, limit }));
}
await runBufferQuery();
render(getResultWindowBufferResults(resultWindowBuffer));

db.changes$.subscribe(async changeEvent => {
    if (applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent) === 'runFullQueryAgain') {
        await runBufferQuery();
    }
    render(getResultWindowBufferResults(resultWindowBuffer));
});
```

| Function | Description |
|---|---|
| `createResultWindowBuffer(queryParams, { limitBufferSize, skipBufferSize })` | Creates an empty buffer. Both sizes default to 0. |
| `getResultWindowBufferQuery(resultWindowBuffer)` | The `skip` and `limit` to run the query with: `skip - skipBufferSize` (at least 0) and `limit` plus both buffers. `limit` is `undefined` if the query has no limit. |
| `resetResultWindowBuffer(resultWindowBuffer, rows)` | Loads the rows of that query. Call it after creating the buffer and after `'runFullQueryAgain'`. |
| `applyChangeEventToResultWindowBuffer(resultWindowBuffer, changeEvent)` | Updates the buffer. Returns `'eventReduce'` (an EventReduce action did it), `'buffer'` (the slice rule did it) or `'runFullQueryAgain'`. |
| `getResultWindowBufferResults(resultWindowBuffer)` | The visible result, the rows of the original skip and limit. |

The functions mutate the `resultWindowBuffer` object. Treat its fields as read only.
It works for any query: with a limit, with a skip, with both or with neither.
Without a limit, the buffer always runs to the end of the result, so `limitBufferSize` is not used.
Without a skip, `skipBufferSize` is not used.

### Proof by test

[`result-window-buffer.test.ts`](../javascript/test/unit/result-window-buffer.test.ts) runs seeded random inserts, updates
(including changes of the sort field and of the matching field) and deletes.
The queries use a limit, skip + limit, skip without limit and neither, with ascending and descending sort.
The buffer sizes are 0/0, 5/0, 0/5, 20/3 and 50/20 (`limitBufferSize`/`skipBufferSize`),
and the runs start with 0, 30 or 300 rows, so the result grows, moves and shrinks to nothing.
After **every** event the test checks that:

- the visible result equals the full query;
- the buffer equals the rows `[offset, offset + buffer.length)` of the full result;
- a complete buffer holds all rows after `offset`;
- the buffer holds no more rows than requested on both sides.

It runs 135 combinations with 600 events each, as part of `npm run test` in `javascript`.
If you break the slice rule, the offset bookkeeping or the trimming, the test fails.

## Choosing the buffer sizes

Each row that leaves the window at the end makes the buffer one row shorter at the end,
and each row that is added in front of the window uses up one row of the buffer before it.
So a full query is needed after about `limitBufferSize + 1` rows left the window,
or after about `skipBufferSize + 1` rows were added in front of it.
Rows that move the other way make the buffer longer again, so the real number is a bit lower.
In the benchmark, `limit 20` needed 1,429 full queries without a buffer, then 220 (÷ 6.5), 62 (÷ 23) and 25 (÷ 57)
with 5, 20 and 50 rows. `skip 20 + limit 20` behaves the same: 1,501 without a buffer, then 219, 61 and 25.

- Start with both sizes about equal to `limit`.
  This removes most full queries, and each query reads at most three times as many rows.
- If `skip` is not larger than `skipBufferSize`, the buffer holds all skipped rows,
  and a row added in front of the window never needs a full query.
- Use a bigger `limitBufferSize` when many rows leave the window, for example a list where users often delete or move what they see.
  Use a bigger `skipBufferSize` when many rows are added in front of the window, for example new rows at the top of a paged list.
- The gain gets smaller as the buffer grows, while memory and the rows read per full query keep growing.

## Trade-offs

- **More rows per full query.** Each query reads up to `skipBufferSize + limit + limitBufferSize` rows instead of `limit`.
  This matters for databases with an index on the sort fields, where the cost grows with the rows read.
  For an unindexed query that filters and sorts everything (like the in-memory table of the benchmark), the extra rows cost almost nothing.
  The total rows read went down in all our measurements, because there are fewer queries.
- **More memory.** You hold the window plus both buffers per query.
- **No skip and no limit, no gain.** Then EventReduce never needs an unknown row, and the buffer is the result itself.
- **The buffer fills up only partly by itself.** Rows that move into the range of the buffer make it longer again.
  But rows outside of it are unknown, so a buffer that lost many rows stays short until the next full query.

## Measurements

### Benchmark

10,000 rows, 5,000 events (1 insert : 3 updates : 1 delete), seed 2026, query `gender === 'f'`, sorted by `age` then `_id`,
Node.js 22 on 4 CPU cores. A full query filters and sorts the whole in-memory table (about 1.7 ms each).
`bufferSize` is used for both sides, as `limitBufferSize` and as `skipBufferSize`.
Time is the time spent to keep the result up to date, including the full queries, without the writes.
All strategies were checked against a full query after every event: there were 0 wrong results.

**Visible events:** 40 % of the events update or delete a row of the current visible result, like a user who edits what they see.
The rest are random events on any row.

| Query | Strategy | Full queries | Share | Time | Rows read |
|---|---|---:|---:|---:|---:|
| limit 20 | full query each time | 5,000 | 100 % | 8,807 ms | 100,000 |
| limit 20 | EventReduce | 1,429 | 28.58 % | 2,554 ms | 28,580 |
| limit 20 | bufferSize 0 | 1,429 | 28.58 % | 2,573 ms | 28,580 |
| limit 20 | bufferSize 5 | 220 | 4.40 % | 410 ms | 5,500 |
| limit 20 | bufferSize 20 | 62 | 1.24 % | 125 ms | 2,480 |
| limit 20 | bufferSize 50 | 25 | 0.50 % | 50 ms | 1,750 |
| limit 100 | full query each time | 5,000 | 100 % | 8,645 ms | 500,000 |
| limit 100 | EventReduce | 1,436 | 28.72 % | 2,539 ms | 143,600 |
| limit 100 | bufferSize 0 | 1,436 | 28.72 % | 2,555 ms | 143,600 |
| limit 100 | bufferSize 5 | 220 | 4.40 % | 409 ms | 23,100 |
| limit 100 | bufferSize 20 | 61 | 1.22 % | 125 ms | 7,320 |
| limit 100 | bufferSize 50 | 25 | 0.50 % | 56 ms | 3,750 |
| skip 20 + limit 20 | full query each time | 5,000 | 100 % | 8,594 ms | 100,000 |
| skip 20 + limit 20 | EventReduce | 1,502 | 30.04 % | 2,614 ms | 30,040 |
| skip 20 + limit 20 | bufferSize 0 | 1,501 | 30.02 % | 2,624 ms | 30,020 |
| skip 20 + limit 20 | bufferSize 5 | 219 | 4.38 % | 390 ms | 6,570 |
| skip 20 + limit 20 | bufferSize 20 | 61 | 1.22 % | 116 ms | 3,660 |
| skip 20 + limit 20 | bufferSize 50 | 25 | 0.50 % | 52 ms | 2,250 |
| skip 20 | full query each time | 5,000 | 100 % | 8,470 ms | 22,294,800 |
| skip 20 | EventReduce | 7 | 0.14 % | 101 ms | 30,938 |
| skip 20 | bufferSize 0 | 7 | 0.14 % | 101 ms | 30,938 |
| skip 20 | bufferSize 5 | 0 | 0 % | 77 ms | 0 |
| skip 20 | bufferSize 20 | 0 | 0 % | 70 ms | 0 |
| skip 20 | bufferSize 50 | 0 | 0 % | 69 ms | 0 |

**Uniform events:** every row is equally likely to change. With 10,000 rows, few events touch the first rows,
so EventReduce alone already needs very few full queries. The buffer still removes most of the rest.

| Query | Strategy | Full queries | Share | Time | Rows read |
|---|---|---:|---:|---:|---:|
| limit 20 | full query each time | 5,000 | 100 % | 9,791 ms | 100,000 |
| limit 20 | EventReduce | 4 | 0.08 % | 31 ms | 80 |
| limit 20 | bufferSize 0 | 4 | 0.08 % | 20 ms | 80 |
| limit 20 | bufferSize 5 | 0 | 0 % | 6 ms | 0 |
| limit 20 | bufferSize 20 | 0 | 0 % | 6 ms | 0 |
| limit 20 | bufferSize 50 | 0 | 0 % | 4 ms | 0 |
| limit 100 | full query each time | 5,000 | 100 % | 10,014 ms | 500,000 |
| limit 100 | EventReduce | 25 | 0.50 % | 73 ms | 2,500 |
| limit 100 | bufferSize 0 | 25 | 0.50 % | 69 ms | 2,500 |
| limit 100 | bufferSize 5 | 2 | 0.04 % | 13 ms | 210 |
| limit 100 | bufferSize 20 | 0 | 0 % | 7 ms | 0 |
| limit 100 | bufferSize 50 | 0 | 0 % | 7 ms | 0 |
| skip 20 + limit 20 | full query each time | 5,000 | 100 % | 9,602 ms | 100,000 |
| skip 20 + limit 20 | EventReduce | 17 | 0.34 % | 65 ms | 340 |
| skip 20 + limit 20 | bufferSize 0 | 17 | 0.34 % | 53 ms | 340 |
| skip 20 + limit 20 | bufferSize 5 | 0 | 0 % | 7 ms | 0 |
| skip 20 + limit 20 | bufferSize 20 | 0 | 0 % | 6 ms | 0 |
| skip 20 + limit 20 | bufferSize 50 | 0 | 0 % | 10 ms | 0 |
| skip 20 | full query each time | 5,000 | 100 % | 9,648 ms | 24,900,541 |
| skip 20 | EventReduce | 6 | 0.12 % | 106 ms | 29,837 |
| skip 20 | bufferSize 0 | 6 | 0.12 % | 113 ms | 29,837 |
| skip 20 | bufferSize 5 | 0 | 0 % | 79 ms | 0 |
| skip 20 | bufferSize 20 | 0 | 0 % | 78 ms | 0 |
| skip 20 | bufferSize 50 | 0 | 0 % | 69 ms | 0 |

The times are dominated by the full queries, so a database where queries are slower (for example IndexedDB) gains more.
Run the benchmark with `npm run benchmark:result-window-buffer` in `examples/browser`.

### Random queries of the fuzzing

The fuzzing of EventReduce uses random queries (with and without skip and limit, different sorts and selectors)
and events where half are aimed at the edges of a result window.
With these, we counted the share of event+query combinations that need no full query
(300 runs × 30 random queries × 100 events = 900,000 combinations; 0 wrong results):

| Queries | EventReduce | 20 after the window only | 20 before the window only | both 5 | both 20 |
|---|---:|---:|---:|---:|---:|
| all | 95.0 % | 96.4 % | 98.9 % | 99.9 % | 100.0 % |
| no skip, no limit | 100.0 % | 100.0 % | 100.0 % | 100.0 % | 100.0 % |
| skip, no limit | 92.4 % | 92.6 % | 100.0 % | 99.7 % | 100.0 % |
| limit, no skip | 97.3 % | 100.0 % | 97.8 % | 99.9 % | 100.0 % |
| limit + skip | 90.2 % | 92.9 % | 97.8 % | 99.7 % | 100.0 % |

The data sets of the fuzzing are small (skips of up to 15), so a buffer of 20 rows on each side often holds all skipped rows
or the whole result. The benchmark above, with 10,000 rows, shows how it behaves on bigger data.
