using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;

namespace EventReduce.Tests
{
    /// <summary>
    /// Basic tests of the result window buffer,
    /// ported from javascript/test/unit/result-window-buffer.test.ts.
    /// </summary>
    public class ResultWindowBufferTests
    {
        public sealed record Doc(string Id, int Age, bool Female = true);

        public sealed record TestQuery(bool Asc, int? Skip = null, int? Limit = null);

        private const int All = ResultWindowBuffer.AllRows;

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

        private static string Ids(IEnumerable<Doc> docs) => string.Join(",", docs.Select(d => d.Id));

        private static string Results(ResultWindowBuffer<Doc> buffer) => Ids(buffer.GetResults());

        private static ChangeEvent<Doc> Insert(Doc doc) => ChangeEvent<Doc>.Insert(doc.Id, doc);

        private static ChangeEvent<Doc> Update(Doc previous, Doc doc) => ChangeEvent<Doc>.Update(doc.Id, doc, previous);

        private static ChangeEvent<Doc> Delete(Doc previous) => ChangeEvent<Doc>.Delete(previous.Id, previous);

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
        public void ReturnsNoRowsForAQueryWithLimit0()
        {
            var buffer = BufferOf(new TestQuery(true, 2, 0), 2, 2);
            // no rows are kept, so the buffer query asks for none
            Assert.Equal(new ResultWindowBufferQuery(2, 0), buffer.GetQuery());
            buffer.Reset(new List<Doc>());
            foreach (var changeEvent in new[] { Insert(new Doc("a", 1)), Update(new Doc("a", 1), new Doc("a", 2)), Delete(new Doc("a", 2)) })
            {
                Assert.Equal(ResultWindowBufferResult.EventReduce, buffer.ApplyChangeEvent(changeEvent));
                Assert.Equal("", Results(buffer));
            }
        }
    }
}
