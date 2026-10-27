using System.Collections.Generic;
using System.Linq;
using Xunit;
using static EventReduce.Tests.Helper;

namespace EventReduce.Tests
{
    public class ActionsTests
    {
        [Fact]
        public void ActionNamesMatchTheJavaScriptOrder()
        {
            Assert.Equal(
                new[]
                {
                    "doNothing", "insertFirst", "insertLast", "removeFirstItem", "removeLastItem",
                    "removeFirstInsertLast", "removeLastInsertFirst", "removeFirstInsertFirst",
                    "removeLastInsertLast", "removeExisting", "replaceExisting", "alwaysWrong",
                    "insertAtSortPosition", "removeExistingAndInsertAtSortPosition",
                    "insertAtSortPositionRemoveLast", "insertAtSortPositionRemoveFirst", "runFullQueryAgain",
                    "unknownAction",
                },
                Actions.OrderedActionList.Select(a => a.ToJsName()));
        }

        [Fact]
        public void AllActionsDoNotCrashOnAnyInput()
        {
            var queryParams = QueryParams(0, limit: 3);
            var changeEvents = new[] { Insert(new Human("x", 3)), Update(new Human("b", 2), new Human("b", 7)), Delete(new Human("b", 2)) };
            var throwing = new HashSet<ActionName> { ActionName.AlwaysWrong, ActionName.RunFullQueryAgain, ActionName.UnknownAction };
            foreach (var action in Actions.OrderedActionList)
            {
                foreach (var changeEvent in changeEvents)
                {
                    foreach (var start in new[] { new List<Human>(), new List<Human> { new("a", 1), new("b", 2), new("c", 3) } })
                    {
                        foreach (var useMap in new[] { true, false })
                        {
                            var results = start.ToList();
                            void Run() => EventReducer.RunAction(action, queryParams, changeEvent, results, useMap ? ToMap(results) : null);
                            if (throwing.Contains(action))
                            {
                                Assert.Throws<EventReduceException>(Run);
                            }
                            else
                            {
                                try
                                {
                                    Run();
                                }
                                catch (EventReduceException)
                                {
                                    // inserting actions on a delete event have no document
                                    Assert.False(changeEvent.HasDoc);
                                }
                            }
                        }
                    }
                }
            }
        }

        [Fact]
        public void RunFullQueryAgainThrows()
        {
            var results = new List<Human> { new("a", 1) };
            var error = Assert.Throws<EventReduceException>(
                () => EventReducer.RunAction(ActionName.RunFullQueryAgain, QueryParams(0), Insert(new Human("b", 1)), results));
            Assert.Equal("EventReduce:RUN_FULL", error.Message);
            Assert.Equal(new[] { "a" }, Ids(results));
        }

        [Fact]
        public void RemoveExistingFromTheMiddleKeepsTheMapInSync()
        {
            var results = new List<Human> { new("a", 1), new("b", 2), new("c", 3) };
            var map = ToMap(results);
            EventReducer.RunAction(ActionName.RemoveExisting, QueryParams(0), Delete(new Human("b", 2)), results, map);
            Assert.Equal(new[] { "a", "c" }, Ids(results));
            Assert.Equal(new[] { "a", "c" }, map.Keys.OrderBy(k => k));
        }

        [Fact]
        public void ReplaceExistingAtTheSamePosition()
        {
            var results = new List<Human> { new("a", 1), new("b", 2), new("c", 3) };
            var map = ToMap(results);
            var renamed = new Human("b", 2, "new");
            EventReducer.RunAction(ActionName.ReplaceExisting, QueryParams(0), Update(new Human("b", 2), renamed), results, map);
            Assert.Same(renamed, results[1]);
            Assert.Same(renamed, map["b"]);
        }

        [Fact]
        public void InsertAtSortPosition()
        {
            var queryParams = QueryParams(0);
            var results = new List<Human>();
            foreach (var doc in new[] { new Human("b", 5), new Human("d", 9), new Human("a", 5), new Human("c", 7) })
            {
                EventReducer.RunAction(ActionName.InsertAtSortPosition, queryParams, Insert(doc), results);
            }
            Assert.Equal(new[] { "a", "b", "c", "d" }, Ids(results));
            // inserting a document that is already in the results does nothing
            EventReducer.RunAction(ActionName.InsertAtSortPosition, queryParams, Insert(new Human("c", 7)), results);
            Assert.Equal(new[] { "a", "b", "c", "d" }, Ids(results));
        }

        [Fact]
        public void RemoveFirstInsertLastWithMap()
        {
            var results = new List<Human> { new("a", 1), new("b", 2) };
            var map = ToMap(results);
            EventReducer.RunAction(ActionName.RemoveFirstInsertLast, QueryParams(0, limit: 2), Insert(new Human("c", 3)), results, map);
            Assert.Equal(new[] { "b", "c" }, Ids(results));
            Assert.Equal(new[] { "b", "c" }, map.Keys.OrderBy(k => k));
        }

        [Fact]
        public void InsertAtSortPositionRemoveLastAndFirst()
        {
            var queryParams = QueryParams(0, limit: 3);
            var results = new List<Human> { new("a", 1), new("c", 3), new("e", 5) };
            var map = ToMap(results);
            EventReducer.RunAction(ActionName.InsertAtSortPositionRemoveLast, queryParams, Insert(new Human("b", 2)), results, map);
            Assert.Equal(new[] { "a", "b", "c" }, Ids(results));
            EventReducer.RunAction(ActionName.InsertAtSortPositionRemoveFirst, queryParams, Insert(new Human("d", 4)), results, map);
            Assert.Equal(new[] { "b", "c", "d" }, Ids(results));
            Assert.Equal(new[] { "b", "c", "d" }, map.Keys.OrderBy(k => k));
            // a document that is already in the results is not inserted, so nothing is removed
            EventReducer.RunAction(ActionName.InsertAtSortPositionRemoveLast, queryParams, Insert(new Human("c", 3)), results);
            Assert.Equal(new[] { "b", "c", "d" }, Ids(results));
        }

        [Fact]
        public void WorksWithStructDocuments()
        {
            var queryParams = new QueryParams<(string Id, int Age)>
            {
                GetDocumentId = doc => doc.Id,
                QueryMatcher = doc => doc.Age > 0,
                SortComparator = (a, b) => a.Age != b.Age ? a.Age.CompareTo(b.Age) : string.CompareOrdinal(a.Id, b.Id),
                SortFieldsChanged = (prev, doc) => prev.Age != doc.Age,
            };
            var results = new List<(string Id, int Age)> { ("a", 1), ("c", 3) };
            var changeEvent = ChangeEvent<(string Id, int Age)>.Insert("b", ("b", 2));
            var action = EventReducer.CalculateActionName(new StateResolveFunctionInput<(string Id, int Age)>(queryParams, changeEvent, results));
            EventReducer.RunAction(action, queryParams, changeEvent, results);
            Assert.Equal(new[] { "a", "b", "c" }, results.Select(r => r.Id));
        }
    }
}
