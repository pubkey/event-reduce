using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using static EventReduce.Tests.Helper;

namespace EventReduce.Tests
{
    /// <summary>
    /// Applies random change events and checks that the results of EventReduce
    /// are equal to the results of running the full query over the database again.
    /// </summary>
    public class FuzzingTests
    {
        private static List<Human> RunFullQuery(QueryParams<Human> queryParams, Dictionary<string, Human> db)
        {
            var all = db.Values.Where(queryParams.QueryMatcher).ToList();
            all.Sort(queryParams.SortComparator);
            var start = Math.Min(queryParams.Skip ?? 0, all.Count);
            var end = queryParams.Limit is int limit ? Math.Min(start + limit, all.Count) : all.Count;
            return all.GetRange(start, end - start);
        }

        private static int Fuzz(int seed, int? skip, int? limit, bool useMap)
        {
            var random = new Random(seed);
            var queryParams = QueryParams(10, skip, limit);
            var db = new Dictionary<string, Human>();
            var ids = new List<string>();
            var results = RunFullQuery(queryParams, db);
            var map = ToMap(results);
            var optimized = 0;
            for (var i = 0; i < 1000; i++)
            {
                ChangeEvent<Human> changeEvent;
                if (ids.Count == 0 || random.Next(3) == 0)
                {
                    var doc = new Human("doc" + i, random.Next(40));
                    db[doc.Id] = doc;
                    ids.Add(doc.Id);
                    changeEvent = Insert(doc);
                }
                else
                {
                    var index = random.Next(ids.Count);
                    var previous = db[ids[index]];
                    if (random.Next(3) == 0)
                    {
                        db.Remove(previous.Id);
                        ids.RemoveAt(index);
                        changeEvent = Delete(previous);
                    }
                    else
                    {
                        var doc = random.Next(4) == 0 ? previous with { Name = "renamed" + i } : previous with { Age = random.Next(40) };
                        db[doc.Id] = doc;
                        changeEvent = Update(previous, doc);
                    }
                }

                var action = EventReducer.CalculateActionName(
                    new StateResolveFunctionInput<Human>(queryParams, changeEvent, results, useMap ? map : null));
                Assert.NotEqual(ActionName.UnknownAction, action);
                if (action == ActionName.RunFullQueryAgain)
                {
                    results = RunFullQuery(queryParams, db);
                    map = ToMap(results);
                }
                else
                {
                    optimized++;
                    EventReducer.RunAction(action, queryParams, changeEvent, results, useMap ? map : null);
                    Assert.Equal(RunFullQuery(queryParams, db), results);
                    if (useMap)
                    {
                        Assert.Equal(ToMap(results), map);
                    }
                }
            }
            return optimized;
        }

        [Theory]
        [InlineData(null, null, false)]
        [InlineData(null, null, true)]
        [InlineData(null, 1, false)]
        [InlineData(null, 5, false)]
        [InlineData(null, 5, true)]
        [InlineData(3, 5, false)]
        [InlineData(3, 5, true)]
        public void SameResultsAsRunningTheFullQuery(int? skip, int? limit, bool useMap)
        {
            for (var seed = 1; seed <= 10; seed++)
            {
                Assert.True(Fuzz(seed * 7919, skip, limit, useMap) > 0);
            }
        }
    }
}
