using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using static EventReduce.Tests.Helper;

namespace EventReduce.Tests
{
    public class StatesTests
    {
        private static bool Resolve(
            StateName state,
            QueryParams<Human> queryParams,
            ChangeEvent<Human> changeEvent,
            IEnumerable<Human> results,
            Dictionary<string, Human>? map = null) =>
            States.ResolveState(state, Input(queryParams, changeEvent, results, map));

        private static readonly Human[] None = Array.Empty<Human>();

        [Fact]
        public void StateNamesMatchTheJavaScriptOrder()
        {
            Assert.Equal(
                new[]
                {
                    "isInsert", "isUpdate", "isDelete", "hasLimit", "isFindOne", "hasSkip",
                    "wasResultsEmpty", "wasLimitReached", "wasFirst", "wasLast", "sortParamsChanged",
                    "wasInResult", "wasSortedBeforeFirst", "wasSortedAfterLast", "isSortedBeforeFirst",
                    "isSortedAfterLast", "wasMatching", "doesMatchNow",
                },
                States.OrderedStateList.Select(s => s.ToJsName()));
        }

        [Fact]
        public void LimitAndSkip()
        {
            var changeEvent = Insert(new Human("a", 20));
            var queryParams = QueryParams(0, skip: 2, limit: 1);
            Assert.True(Resolve(StateName.HasLimit, queryParams, changeEvent, None));
            Assert.True(Resolve(StateName.IsFindOne, queryParams, changeEvent, None));
            Assert.True(Resolve(StateName.HasSkip, queryParams, changeEvent, None));
            Assert.True(Resolve(StateName.WasLimitReached, queryParams, changeEvent, new[] { new Human("b", 1) }));
            queryParams = QueryParams(0, skip: 0);
            Assert.False(Resolve(StateName.HasLimit, queryParams, changeEvent, None));
            Assert.False(Resolve(StateName.IsFindOne, queryParams, changeEvent, None));
            Assert.False(Resolve(StateName.HasSkip, queryParams, changeEvent, None));
            Assert.False(Resolve(StateName.WasLimitReached, queryParams, changeEvent, new[] { new Human("b", 1) }));
        }

        [Fact]
        public void Operations()
        {
            var changeEvent = Delete(new Human("a", 1));
            Assert.True(Resolve(StateName.IsDelete, QueryParams(0), changeEvent, None));
            Assert.False(Resolve(StateName.IsInsert, QueryParams(0), changeEvent, None));
            Assert.False(Resolve(StateName.IsUpdate, QueryParams(0), changeEvent, None));
        }

        [Fact]
        public void SortParamsChanged()
        {
            var queryParams = QueryParams(0);
            var a = new Human("a", 1);
            Assert.False(Resolve(StateName.SortParamsChanged, queryParams, Update(a, a with { Name = "other" }), None));
            Assert.True(Resolve(StateName.SortParamsChanged, queryParams, Update(a, a with { Age = 2 }), None));
            Assert.True(Resolve(StateName.SortParamsChanged, queryParams, Insert(a), None));
            Assert.False(Resolve(StateName.SortParamsChanged, queryParams, Delete(a), None));
        }

        [Fact]
        public void WasInResultWithAndWithoutMap()
        {
            var queryParams = QueryParams(0);
            var changeEvent = Update(new Human("b", 1), new Human("b", 2));
            var results = new[] { new Human("a", 1), new Human("b", 1) };
            Assert.True(Resolve(StateName.WasInResult, queryParams, changeEvent, results));
            Assert.False(Resolve(StateName.WasInResult, queryParams, changeEvent, results.Take(1)));
            Assert.True(Resolve(StateName.WasInResult, queryParams, changeEvent, results, ToMap(results)));
        }

        [Fact]
        public void FirstAndLast()
        {
            var queryParams = QueryParams(0);
            var results = new[] { new Human("a", 1), new Human("b", 5), new Human("c", 10) };
            var changeEvent = Update(new Human("a", 1), new Human("a", 20));
            Assert.True(Resolve(StateName.WasFirst, queryParams, changeEvent, results));
            Assert.False(Resolve(StateName.WasLast, queryParams, changeEvent, results));
            // the changed document is the first one, so it must be true
            Assert.True(Resolve(StateName.WasSortedBeforeFirst, queryParams, changeEvent, results));
            Assert.False(Resolve(StateName.WasSortedAfterLast, queryParams, changeEvent, results));
            Assert.True(Resolve(StateName.IsSortedAfterLast, queryParams, changeEvent, results));
            changeEvent = Insert(new Human("d", 0));
            Assert.True(Resolve(StateName.IsSortedBeforeFirst, queryParams, changeEvent, results));
            Assert.False(Resolve(StateName.IsSortedAfterLast, queryParams, changeEvent, results));
            Assert.False(Resolve(StateName.WasSortedBeforeFirst, queryParams, changeEvent, results));
            Assert.False(Resolve(StateName.IsSortedBeforeFirst, queryParams, changeEvent, None));
        }

        [Fact]
        public void IsSortedComparesWithTheNeighborWhenTheChangedDocumentIsFirstOrLast()
        {
            var queryParams = QueryParams(0);
            var results = new[] { new Human("a", 1), new Human("b", 5), new Human("c", 10) };
            // the first document moves behind the second one
            Assert.False(Resolve(StateName.IsSortedBeforeFirst, queryParams, Update(new Human("a", 1), new Human("a", 7)), results));
            // the first document stays first
            Assert.True(Resolve(StateName.IsSortedBeforeFirst, queryParams, Update(new Human("a", 1), new Human("a", 2)), results));
            // the last document moves before the second last one
            Assert.False(Resolve(StateName.IsSortedAfterLast, queryParams, Update(new Human("c", 10), new Human("c", 3)), results));
            // the last document stays last
            Assert.True(Resolve(StateName.IsSortedAfterLast, queryParams, Update(new Human("c", 10), new Human("c", 20)), results));
            // without a neighbor, the changed document is still first and last
            var changeEvent = Update(new Human("a", 1), new Human("a", 7));
            Assert.True(Resolve(StateName.IsSortedBeforeFirst, queryParams, changeEvent, results.Take(1)));
            Assert.True(Resolve(StateName.IsSortedAfterLast, queryParams, changeEvent, results.Take(1)));
        }

        [Fact]
        public void Matching()
        {
            var queryParams = QueryParams(10);
            var changeEvent = Update(new Human("a", 5), new Human("a", 20));
            Assert.False(Resolve(StateName.WasMatching, queryParams, changeEvent, None));
            Assert.True(Resolve(StateName.DoesMatchNow, queryParams, changeEvent, None));
            Assert.True(Resolve(StateName.WasResultsEmpty, queryParams, changeEvent, None));
        }

        [Fact]
        public void StateSet()
        {
            Assert.Equal("100000100010000001", States.GetStateSet(Input(QueryParams(0), Insert(new Human("a", 1)), None)));
        }
    }
}
