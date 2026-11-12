using System;
using System.Collections.Generic;
using Xunit;

namespace RxDB.EventReduce.Tests
{
    /// <summary>Like in SQL, a query with limit 0 returns no documents. A negative limit throws.</summary>
    public class LimitTests
    {
        private sealed record Row(string Id, int Age);

        private static QueryParams<Row> Params(int? limit, int? skip = null) => new QueryParams<Row>
        {
            GetDocumentId = d => d.Id,
            Skip = skip,
            Limit = limit,
            QueryMatcher = d => true,
            SortComparator = (a, b) => a.Age != b.Age ? a.Age.CompareTo(b.Age) : string.CompareOrdinal(a.Id, b.Id),
            SortFieldsChanged = (previous, doc) => previous.Age != doc.Age,
        };

        private static readonly Row A = new Row("a", 1);

        private static readonly ChangeEvent<Row>[] Events =
        {
            ChangeEvent<Row>.Insert("a", A),
            ChangeEvent<Row>.Update("a", new Row("a", 2), A),
            ChangeEvent<Row>.Delete("a", A),
        };

        private static ActionName Calculate(QueryParams<Row> queryParams, ChangeEvent<Row> changeEvent) =>
            EventReducer.CalculateActionName(
                new StateResolveFunctionInput<Row>(queryParams, changeEvent, new List<Row>()));

        [Fact]
        public void LimitZeroIsAlwaysDoNothing()
        {
            foreach (var skip in new int?[] { null, 0, 3 })
            {
                foreach (var changeEvent in Events)
                {
                    Assert.Equal(ActionName.DoNothing, Calculate(Params(0, skip), changeEvent));
                }
            }
        }

        [Fact]
        public void OtherLimitsAreNotChanged()
        {
            Assert.Equal(ActionName.InsertFirst, Calculate(Params(1), Events[0]));
            Assert.Equal(ActionName.InsertFirst, Calculate(Params(null), Events[0]));
        }

        [Fact]
        public void NegativeLimitThrows()
        {
            Assert.Equal("NEG_LIMIT", Assert.Throws<EventReduceException>(() => Calculate(Params(-1), Events[0])).Code);
            Assert.Equal(
                "NEG_LIMIT",
                Assert.Throws<EventReduceException>(() => new ResultWindowBuffer<Row>(Params(-1))).Code);
            _ = new ResultWindowBuffer<Row>(Params(0));
        }

        [Fact]
        public void NegativeLimitHasRecommendedBufferSizeZero()
        {
            Assert.Equal(0, ResultWindowBuffer.GetRecommendedSize(-1));
            Assert.Equal(0, ResultWindowBuffer.GetRecommendedSize(-400));
            // the limit is checked before the sizes
            Assert.Equal(
                "NEG_LIMIT",
                Assert.Throws<EventReduceException>(() => new ResultWindowBuffer<Row>(Params(-1), -1, -1)).Code);
        }
    }
}
