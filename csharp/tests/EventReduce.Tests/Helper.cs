using System.Collections.Generic;
using System.Linq;
using EventReduce;

namespace EventReduce.Tests
{
    public sealed record Human(string Id, int Age, string? Name = null)
    {
        public string Name { get; init; } = Name ?? "name-" + Id;
    }

    public static class Helper
    {
        /// <summary>SELECT * FROM humans WHERE age &gt; minAge ORDER BY age, id</summary>
        public static QueryParams<Human> QueryParams(int minAge, int? skip = null, int? limit = null) => new()
        {
            GetDocumentId = doc => doc.Id,
            Skip = skip,
            Limit = limit,
            QueryMatcher = doc => doc.Age > minAge,
            SortComparator = (a, b) => a.Age != b.Age ? a.Age.CompareTo(b.Age) : string.CompareOrdinal(a.Id, b.Id),
            SortFieldsChanged = (prev, doc) => prev.Age != doc.Age,
        };

        public static ChangeEvent<Human> Insert(Human doc) => ChangeEvent<Human>.Insert(doc.Id, doc);

        public static ChangeEvent<Human> Update(Human previous, Human doc) => ChangeEvent<Human>.Update(doc.Id, doc, previous);

        public static ChangeEvent<Human> Delete(Human previous) => ChangeEvent<Human>.Delete(previous.Id, previous);

        public static Dictionary<string, Human> ToMap(IEnumerable<Human> docs) => docs.ToDictionary(d => d.Id);

        public static List<string> Ids(IEnumerable<Human> docs) => docs.Select(d => d.Id).ToList();

        public static StateResolveFunctionInput<Human> Input(
            QueryParams<Human> queryParams,
            ChangeEvent<Human> changeEvent,
            IEnumerable<Human> previousResults,
            Dictionary<string, Human>? map = null) =>
            new(queryParams, changeEvent, previousResults.ToList(), map);
    }
}
