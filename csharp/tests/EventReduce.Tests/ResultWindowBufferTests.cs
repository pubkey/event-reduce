using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace EventReduce.Tests
{
    /// <summary>
    /// Port of javascript/test/unit/result-window-buffer.test.ts
    /// After every event, the visible result must equal the full query,
    /// and the buffer must be an exact slice of the full result.
    /// </summary>
    public class ResultWindowBufferTests
    {
        public sealed record Doc(string Id, int Age, bool Female = true);

        public sealed record TestQuery(bool Asc, int? Skip = null, int? Limit = null);

        private sealed record Weights(double Insert, double Update, double Delete);

        /// <summary>The documents of the database, with the ids in an array to pick random documents fast.</summary>
        private sealed class Docs
        {
            public readonly Dictionary<string, Doc> ById = new();
            private readonly List<string> ids = new();

            public int Count => ids.Count;

            public Doc At(int index) => ById[ids[index]];

            public void Apply(ChangeEvent<Doc> changeEvent)
            {
                var id = changeEvent.Id;
                if (changeEvent.HasDoc)
                {
                    if (!ById.ContainsKey(id))
                    {
                        ids.Add(id);
                    }
                    ById[id] = changeEvent.Doc;
                }
                else if (ById.Remove(id))
                {
                    var index = ids.IndexOf(id);
                    ids[index] = ids[ids.Count - 1];
                    ids.RemoveAt(ids.Count - 1);
                }
            }
        }

        private static readonly TestQuery[] Queries =
        {
            new(true, Limit: 20),
            new(false, Limit: 20),
            new(true, Skip: 10, Limit: 20),
            new(false, Skip: 10, Limit: 20),
            new(true, Limit: 1),
            new(false, Skip: 3, Limit: 5),
            // skip without limit
            new(true, Skip: 5),
            // neither skip nor limit
            new(true),
        };
        private const int All = ResultWindowBuffer.AllRows;
        private static readonly (int Limit, int Skip)[] BufferSizes = { (0, 0), (5, 0), (0, 5), (20, 3), (50, 20), (All, All) };
        private static readonly int[] InitialRowsList = { 0, 30, 300 };
        private const int EventsPerRun = 600;
        private static readonly Weights OnlyInserts = new(1, 0, 0);

        /// <summary>
        /// The query is always: female, sorted by age, then by id.
        /// Age has only 100 different values, so many rows have the same age
        /// and the id decides their order.
        /// </summary>
        private static QueryParams<Doc> QueryParams(TestQuery query)
        {
            var direction = query.Asc ? 1 : -1;
            return new QueryParams<Doc>
            {
                GetDocumentId = d => d.Id,
                Skip = query.Skip,
                Limit = query.Limit,
                QueryMatcher = d => d.Female,
                SortComparator = (a, b) => direction * (a.Age != b.Age ? a.Age.CompareTo(b.Age) : string.CompareOrdinal(a.Id, b.Id)),
                SortFieldsChanged = (prev, doc) => prev.Age != doc.Age,
            };
        }

        private static ResultWindowBuffer<Doc> BufferOf(TestQuery query, int limitBufferSize = 0, int skipBufferSize = 0) =>
            new(QueryParams(query), limitBufferSize, skipBufferSize);

        /// <summary>Full query over all documents: filter, sort, skip, limit.</summary>
        private static List<Doc> RunQuery(Docs docs, QueryParams<Doc> queryParams, int skip, int? limit)
        {
            var all = docs.ById.Values.Where(queryParams.QueryMatcher).ToList();
            all.Sort(queryParams.SortComparator);
            var start = Math.Min(skip, all.Count);
            var end = limit is int l ? Math.Min(start + l, all.Count) : all.Count;
            return all.GetRange(start, end - start);
        }

        private static void Fill(ResultWindowBuffer<Doc> buffer, Docs docs)
        {
            var query = buffer.GetQuery();
            buffer.Reset(RunQuery(docs, buffer.QueryParams, query.Skip, query.Limit));
        }

        private static string Ids(IEnumerable<Doc> docs) => string.Join(",", docs.Select(d => d.Id));

        private static string Results(ResultWindowBuffer<Doc> buffer) => Ids(buffer.GetResults());

        private static ChangeEvent<Doc> Insert(Doc doc) => ChangeEvent<Doc>.Insert(doc.Id, doc);

        private static ChangeEvent<Doc> Update(Doc previous, Doc doc) => ChangeEvent<Doc>.Update(doc.Id, doc, previous);

        private static ChangeEvent<Doc> Delete(Doc previous) => ChangeEvent<Doc>.Delete(previous.Id, previous);

        /// <summary>
        /// First more inserts, then mostly updates, then more deletes,
        /// so that the result grows, moves around and shrinks to (almost) nothing.
        /// </summary>
        private static Weights GetWeights(int eventIndex)
        {
            var phase = (double)eventIndex / EventsPerRun;
            if (phase < 0.4)
            {
                return new Weights(3, 5, 1);
            }
            return phase < 0.7 ? new Weights(1, 8, 1) : new Weights(1, 3, 5);
        }

        private static ChangeEvent<Doc> RandomChangeEvent(Docs docs, Random random, Func<string> newId, Weights weights)
        {
            var total = weights.Insert + weights.Update + weights.Delete;
            var r = random.NextDouble() * total;
            if (docs.Count == 0 || r < weights.Insert)
            {
                return Insert(new Doc(newId(), random.Next(1, 101), random.NextDouble() < 0.5));
            }
            r -= weights.Insert;
            var previous = docs.At(random.Next(docs.Count));
            if (r < weights.Update)
            {
                var doc = random.NextDouble() < 0.5
                    // starts or stops matching
                    ? previous with { Female = !previous.Female }
                    // moves in the sort order
                    : previous with { Age = random.Next(1, 101) };
                return Update(previous, doc);
            }
            return Delete(previous);
        }

        private static Func<string> CounterIds()
        {
            var counter = 0;
            return () => "id-" + (counter++).ToString("D5");
        }

        [Fact]
        public void RecommendedSizeForEachLimit()
        {
            var expected = new (int? Limit, int Size)[]
            {
                (null, 0), (0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (10, 3), (20, 4),
                (100, 7), (200, 11), (500, 20), (1000, 26), (2711, 29), (2712, 30), (100000, 30),
            };
            foreach (var (limit, size) in expected)
            {
                Assert.Equal(size, ResultWindowBuffer.GetRecommendedSize(limit));
            }
        }

        [Fact]
        public void QueryAddsTheBufferSizesToTheSkipAndLimit()
        {
            Assert.Equal(new ResultWindowBufferQuery(7, 28), BufferOf(new TestQuery(true, 10, 20), 5, 3).GetQuery());
            // not below skip 0
            Assert.Equal(new ResultWindowBufferQuery(0, 22), BufferOf(new TestQuery(true, 2, 20), 0, 5).GetQuery());
            // not set means 0
            Assert.Equal(new ResultWindowBufferQuery(10, 20), BufferOf(new TestQuery(true, 10, 20)).GetQuery());
            // all rows
            Assert.Equal(new ResultWindowBufferQuery(0, null), BufferOf(new TestQuery(true, 10, 20), All, All).GetQuery());
            // no limit for a query without a limit
            Assert.Equal(new ResultWindowBufferQuery(7, null), BufferOf(new TestQuery(true, 10), 5, 3).GetQuery());
        }

        [Fact]
        public void ThrowsOnNegativeBufferSizes()
        {
            var queryParams = QueryParams(new TestQuery(true, 10, 20));
            Assert.Throws<EventReduceException>(() => new ResultWindowBuffer<Doc>(queryParams, limitBufferSize: -1));
            Assert.Throws<EventReduceException>(() => new ResultWindowBuffer<Doc>(queryParams, skipBufferSize: -1));
        }

        [Fact]
        public void Reset()
        {
            // asks for a full query and has no results before it got rows
            var buffer = BufferOf(new TestQuery(true, Limit: 2));
            Assert.Equal("EventReduce:RWB_OUTDATED", Assert.Throws<EventReduceException>(() => buffer.GetResults()).Message);
            Assert.Equal(ResultWindowBufferResult.RunFullQueryAgain, buffer.ApplyChangeEvent(Insert(new Doc("a", 1))));

            // complete when the query returned fewer rows than requested
            buffer = BufferOf(new TestQuery(true, Limit: 2), 2);
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 2), new Doc("c", 3) });
            Assert.True(buffer.Complete);
            Assert.Equal("a,b", Results(buffer));

            // not complete when the query returned as many rows as requested
            buffer = BufferOf(new TestQuery(true, Limit: 1), 1);
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 2) });
            Assert.False(buffer.Complete);

            // shows the rows after the skipped rows of the buffer
            buffer = BufferOf(new TestQuery(true, 1, 2), 0, 1);
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 2), new Doc("c", 3) });
            Assert.Equal(0, buffer.Offset);
            Assert.Equal("b,c", Results(buffer));
        }

        [Fact]
        public void RefillsTheWindowFromTheBufferWhenAVisibleRowIsDeleted()
        {
            var buffer = BufferOf(new TestQuery(true, Limit: 2), 2);
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 2), new Doc("c", 3), new Doc("d", 4) });
            Assert.Equal(ResultWindowBufferResult.Buffer, buffer.ApplyChangeEvent(Delete(new Doc("a", 1))));
            Assert.Equal("b,c", Results(buffer));
            Assert.Equal("b,c,d", Ids(buffer.Buffer));
        }

        [Fact]
        public void DoesNotAppendARowThatMovesBehindTheLastRowOfTheBuffer()
        {
            var buffer = BufferOf(new TestQuery(true, Limit: 2), 1);
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 2), new Doc("c", 3) });
            Assert.Equal(ResultWindowBufferResult.Buffer, buffer.ApplyChangeEvent(Update(new Doc("a", 1), new Doc("a", 99))));
            Assert.Equal("b,c", Ids(buffer.Buffer));
        }

        [Fact]
        public void AsksForAFullQueryWhenARowIsAddedInFrontOfTheSkipWindowWithoutASkipBuffer()
        {
            var buffer = BufferOf(new TestQuery(true, 1, 1), 1);
            buffer.Reset(new[] { new Doc("b", 2), new Doc("c", 3) });
            Assert.Equal(ResultWindowBufferResult.RunFullQueryAgain, buffer.ApplyChangeEvent(Insert(new Doc("x", 0))));
            // the results are outdated until the query runs again
            Assert.Throws<EventReduceException>(() => buffer.GetResults());
        }

        [Fact]
        public void TakesTheRowFromTheSkipBufferWhenARowIsAddedInFrontOfTheWindow()
        {
            var buffer = BufferOf(new TestQuery(true, 2, 1), 0, 1);
            // skip 1, limit 2: 'a' is skipped and not in the buffer
            buffer.Reset(new[] { new Doc("b", 2), new Doc("c", 3) });
            Assert.Equal("c", Results(buffer));
            Assert.Equal(ResultWindowBufferResult.Buffer, buffer.ApplyChangeEvent(Insert(new Doc("x", 0))));
            Assert.Equal(2, buffer.Offset);
            Assert.Equal("b", Results(buffer));
        }

        [Fact]
        public void ReturnsNoRowsForAQueryWithLimit0()
        {
            var random = new Random(77);
            var newId = CounterIds();
            foreach (var skip in new int?[] { null, 2 })
            {
                var docs = new Docs();
                for (var i = 0; i < 10; i++)
                {
                    docs.Apply(RandomChangeEvent(docs, random, newId, OnlyInserts));
                }
                var buffer = BufferOf(new TestQuery(true, skip, 0), 2, 2);
                Fill(buffer, docs);
                // no rows are kept, so the buffer query asks for none
                Assert.Equal(new ResultWindowBufferQuery(skip ?? 0, 0), buffer.GetQuery());
                Assert.Equal("", Results(buffer));
                for (var i = 0; i < 100; i++)
                {
                    var changeEvent = RandomChangeEvent(docs, random, newId, GetWeights(i));
                    docs.Apply(changeEvent);
                    Assert.Equal(ResultWindowBufferResult.EventReduce, buffer.ApplyChangeEvent(changeEvent));
                    Assert.Equal("", Results(buffer));
                    Assert.Empty(buffer.Buffer);
                }
            }
        }

        [Fact]
        public void HandlesAQueryWithASkipButWithoutALimit()
        {
            var buffer = BufferOf(new TestQuery(true, Skip: 1), 0, 1);
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 2), new Doc("c", 3) });
            Assert.Equal("b,c", Results(buffer));
            Assert.NotEqual(ResultWindowBufferResult.RunFullQueryAgain, buffer.ApplyChangeEvent(Insert(new Doc("x", 0))));
            Assert.Equal("a,b,c", Results(buffer));
        }

        [Fact]
        public void ApplyChangeEventsReturnsTheNewResultsAndIfTheyChanged()
        {
            var buffer = BufferOf(new TestQuery(true, Limit: 2), 3);
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 2), new Doc("c", 3), new Doc("d", 4), new Doc("e", 5) });
            // a row after the result window changes
            var notVisible = buffer.ApplyChangeEvents(new[] { Update(new Doc("e", 5), new Doc("e", 6)) });
            Assert.False(notVisible.RunFullQueryAgain);
            Assert.False(notVisible.Changed);

            var visible = buffer.ApplyChangeEvents(new[] { Delete(new Doc("a", 1)), Delete(new Doc("b", 2)) });
            Assert.False(visible.RunFullQueryAgain);
            Assert.True(visible.Changed);
            Assert.Equal("c,d", Ids(visible.Results));

            // a changed row at the same position is reported as changed
            buffer = BufferOf(new TestQuery(true, Limit: 2));
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 3) });
            var result = buffer.ApplyChangeEvents(new[] { Update(new Doc("a", 1), new Doc("a", 2)) });
            Assert.False(result.RunFullQueryAgain);
            Assert.True(result.Changed);
        }

        [Fact]
        public void ApplyChangeEventsAsksForAFullQueryWhenTheResultWindowDoesNotFitIntoTheBuffer()
        {
            var buffer = BufferOf(new TestQuery(true, Limit: 2));
            Assert.True(buffer.ApplyChangeEvents(Array.Empty<ChangeEvent<Doc>>()).RunFullQueryAgain);
            buffer.Reset(new[] { new Doc("a", 1), new Doc("b", 2) });
            Assert.True(buffer.ApplyChangeEvents(new[] { Delete(new Doc("a", 1)) }).RunFullQueryAgain);
        }

        [Fact]
        public void ApplyChangeEventsReturnsTheSameAsAFullQueryForRandomBatches()
        {
            var random = new Random(4242);
            var newId = CounterIds();
            foreach (var query in Queries)
            {
                var docs = new Docs();
                for (var i = 0; i < 30; i++)
                {
                    docs.Apply(RandomChangeEvent(docs, random, newId, OnlyInserts));
                }
                var queryParams = QueryParams(query);
                var skip = query.Skip ?? 0;
                var buffer = BufferOf(query, 3, 3);
                Fill(buffer, docs);
                var previousResults = RunQuery(docs, queryParams, skip, query.Limit);
                for (var batch = 0; batch < 100; batch++)
                {
                    var changeEvents = new List<ChangeEvent<Doc>>();
                    var batchSize = 1 + random.Next(5);
                    for (var i = 0; i < batchSize; i++)
                    {
                        var changeEvent = RandomChangeEvent(docs, random, newId, GetWeights(batch * 5 + i));
                        docs.Apply(changeEvent);
                        changeEvents.Add(changeEvent);
                    }
                    var result = buffer.ApplyChangeEvents(changeEvents);
                    var expected = RunQuery(docs, queryParams, skip, query.Limit);
                    if (result.RunFullQueryAgain)
                    {
                        Fill(buffer, docs);
                    }
                    else
                    {
                        Assert.Equal(Ids(expected), Ids(result.Results));
                        Assert.Equal(!expected.SequenceEqual(previousResults), result.Changed);
                    }
                    previousResults = expected;
                }
            }
        }

        [Fact]
        public void ABufferWithBothSizes0NeverRunsTheFullQueryWhenEventReduceAloneDoesNot()
        {
            var eventReduceFullQueries = 0;
            var bufferFullQueries = 0;
            var seed = 1000;
            foreach (var query in Queries)
            {
                foreach (var initialRows in InitialRowsList)
                {
                    seed++;
                    var random = new Random(seed);
                    var newId = CounterIds();
                    var docs = new Docs();
                    for (var i = 0; i < initialRows; i++)
                    {
                        docs.Apply(RandomChangeEvent(docs, random, newId, OnlyInserts));
                    }
                    var queryParams = QueryParams(query);
                    var skip = query.Skip ?? 0;
                    var previousResults = RunQuery(docs, queryParams, skip, query.Limit);
                    var keyDocumentMap = previousResults.ToDictionary(d => d.Id);
                    var buffer = BufferOf(query);
                    Fill(buffer, docs);

                    for (var i = 0; i < EventsPerRun; i++)
                    {
                        var changeEvent = RandomChangeEvent(docs, random, newId, GetWeights(i));
                        docs.Apply(changeEvent);

                        var action = EventReducer.CalculateActionName(
                            new StateResolveFunctionInput<Doc>(queryParams, changeEvent, previousResults, keyDocumentMap));
                        var eventReduceNeedsQuery = action == ActionName.RunFullQueryAgain;
                        if (eventReduceNeedsQuery)
                        {
                            eventReduceFullQueries++;
                            previousResults = RunQuery(docs, queryParams, skip, query.Limit);
                            keyDocumentMap = previousResults.ToDictionary(d => d.Id);
                        }
                        else
                        {
                            EventReducer.RunAction(action, queryParams, changeEvent, previousResults, keyDocumentMap);
                        }

                        var bufferNeedsQuery = buffer.ApplyChangeEvent(changeEvent) == ResultWindowBufferResult.RunFullQueryAgain;
                        if (bufferNeedsQuery)
                        {
                            bufferFullQueries++;
                            Fill(buffer, docs);
                        }
                        Assert.True(
                            !bufferNeedsQuery || eventReduceNeedsQuery,
                            $"buffer needs a full query but EventReduce does not at event #{i}");
                        Assert.Equal(Ids(RunQuery(docs, queryParams, skip, query.Limit)), Results(buffer));
                    }
                }
            }
            Assert.True(bufferFullQueries <= eventReduceFullQueries);
        }

        [Fact]
        public void RandomizedAgainstAFullQuery()
        {
            var counts = new Dictionary<ResultWindowBufferResult, int>();
            var seed = 0;
            foreach (var query in Queries)
            {
                foreach (var (limitBufferSize, skipBufferSize) in BufferSizes)
                {
                    foreach (var initialRows in InitialRowsList)
                    {
                        seed++;
                        var random = new Random(seed);
                        var counter = 0;
                        string NewId() => random.Next(1_000_000_000).ToString("D9") + "-" + (++counter);
                        var docs = new Docs();
                        for (var i = 0; i < initialRows; i++)
                        {
                            docs.Apply(RandomChangeEvent(docs, random, NewId, OnlyInserts));
                        }
                        var queryParams = QueryParams(query);
                        var skip = query.Skip ?? 0;
                        var buffer = BufferOf(query, limitBufferSize, skipBufferSize);
                        Fill(buffer, docs);

                        for (var i = 0; i < EventsPerRun; i++)
                        {
                            var changeEvent = RandomChangeEvent(docs, random, NewId, GetWeights(i));
                            docs.Apply(changeEvent);

                            var result = buffer.ApplyChangeEvent(changeEvent);
                            counts[result] = counts.TryGetValue(result, out var count) ? count + 1 : 1;
                            if (result == ResultWindowBufferResult.RunFullQueryAgain)
                            {
                                Fill(buffer, docs);
                            }
                            string Context() =>
                                $"{query}, sizes {limitBufferSize}/{skipBufferSize}, {initialRows} rows, event #{i} ({changeEvent.Operation}, {result})";

                            // the visible result equals the full query
                            var expected = Ids(RunQuery(docs, queryParams, skip, query.Limit));
                            var actual = Results(buffer);
                            Assert.True(expected == actual, $"visible result differs from full query at {Context()}");

                            // the buffer is an exact slice of the full result
                            var full = RunQuery(docs, queryParams, 0, null);
                            if (buffer.Buffer.Count > 0)
                            {
                                var start = Math.Min(buffer.Offset, full.Count);
                                var end = Math.Min(buffer.Offset + buffer.Buffer.Count, full.Count);
                                Assert.True(
                                    Ids(full.GetRange(start, end - start)) == Ids(buffer.Buffer),
                                    $"buffer is not an exact slice of the full result at {Context()}");
                            }
                            else
                            {
                                // an empty buffer only knows an upper bound of the rows before it
                                Assert.True(buffer.Complete, $"empty buffer must be complete at {Context()}");
                                Assert.True(full.Count <= buffer.Offset, $"offset is no upper bound at {Context()}");
                            }
                            if (buffer.Complete)
                            {
                                Assert.True(buffer.Offset + buffer.Buffer.Count >= full.Count, $"complete buffer misses rows at {Context()}");
                            }

                            // the buffer keeps no more rows than requested on both sides
                            var rowsBefore = skip - buffer.Offset;
                            Assert.True(rowsBefore <= skipBufferSize, "too many rows before the window");
                            if (query.Limit is int limit && limitBufferSize != All)
                            {
                                Assert.True(
                                    buffer.Buffer.Count <= Math.Max(0, rowsBefore) + limit + limitBufferSize,
                                    "too many rows after the window");
                            }

                            // the key map matches the buffer
                            Assert.Equal(buffer.Buffer.Count, buffer.KeyDocumentMap.Count);
                            foreach (var d in buffer.Buffer)
                            {
                                Assert.Same(d, buffer.KeyDocumentMap[d.Id]);
                            }
                        }
                    }
                }
            }
            // all three paths are used
            foreach (ResultWindowBufferResult result in Enum.GetValues(typeof(ResultWindowBufferResult)))
            {
                Assert.True(counts.TryGetValue(result, out var count) && count > 0, string.Join(", ", counts));
            }
        }
    }
}
