using System.Collections.Generic;
using Xunit;

namespace RxDB.EventReduce.Tests
{
    /// <summary>
    /// When the key document map is out of sync and does not have a document that is in the results,
    /// the actions must still find the document in the results, like the JavaScript implementation.
    /// </summary>
    public class KeyDocumentMapTests
    {
        private sealed record Row(string Id, int Age, string Name = "");

        private static readonly QueryParams<Row> Params = new QueryParams<Row>
        {
            GetDocumentId = d => d.Id,
            QueryMatcher = d => true,
            SortComparator = (a, b) => a.Age != b.Age ? a.Age.CompareTo(b.Age) : string.CompareOrdinal(a.Id, b.Id),
            SortFieldsChanged = (previous, doc) => previous.Age != doc.Age,
        };

        private static readonly Row A = new Row("a", 1);
        private static readonly Row B = new Row("b", 2);

        private static (List<Row> Results, Dictionary<string, Row> Map) Run(ActionName action, ChangeEvent<Row> changeEvent)
        {
            var keyDocumentMap = new Dictionary<string, Row> { ["b"] = B };
            var results = EventReducer.RunAction(action, Params, changeEvent, new List<Row> { A, B }, keyDocumentMap);
            return (results, keyDocumentMap);
        }

        [Fact]
        public void RemoveExisting()
        {
            var (results, map) = Run(ActionName.RemoveExisting, ChangeEvent<Row>.Delete("a", A));
            Assert.Equal(new[] { B }, results);
            Assert.Equal(new Dictionary<string, Row> { ["b"] = B }, map);
        }

        [Fact]
        public void ReplaceExisting()
        {
            var changed = new Row("a", 1, "changed");
            var (results, map) = Run(ActionName.ReplaceExisting, ChangeEvent<Row>.Update("a", changed, A));
            Assert.Equal(new[] { changed, B }, results);
            Assert.Equal(new Dictionary<string, Row> { ["a"] = changed, ["b"] = B }, map);
        }

        [Fact]
        public void RemoveExistingAndInsertAtSortPosition()
        {
            var moved = new Row("a", 5);
            var (results, map) = Run(
                ActionName.RemoveExistingAndInsertAtSortPosition, ChangeEvent<Row>.Update("a", moved, A));
            // no duplicate of the document
            Assert.Equal(new[] { B, moved }, results);
            Assert.Equal(new Dictionary<string, Row> { ["a"] = moved, ["b"] = B }, map);
        }
    }
}
