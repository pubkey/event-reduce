using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Xunit;

namespace EventReduce.Tests
{
    /// <summary>
    /// Runs the test cases that the JavaScript implementation created,
    /// see javascript/test/helper/port-test-cases.ts.
    /// This implementation only resolves the BDD that was created there,
    /// so it must calculate the same state set and action for every case.
    /// </summary>
    public class PortTestCasesTests
    {
        public sealed record Doc(string Id, int Age);

        private static string CasesPath([CallerFilePath] string path = "") =>
            Path.GetFullPath(Path.Combine(Path.GetDirectoryName(path)!, "..", "..", "..", "javascript", "test", "fixtures", "port-test-cases.json"));

        private static Doc ToDoc(JsonElement element) =>
            new(element.GetProperty("id").GetString()!, element.GetProperty("age").GetInt32());

        private static int? NullableInt(JsonElement element) =>
            element.ValueKind == JsonValueKind.Null ? null : element.GetInt32();

        /// <summary>The query of the test cases: age &gt; minAge, sorted by age, then by id.</summary>
        private static QueryParams<Doc> QueryParams(JsonElement query)
        {
            var minAge = query.GetProperty("minAge").GetInt32();
            return new QueryParams<Doc>
            {
                GetDocumentId = d => d.Id,
                Skip = NullableInt(query.GetProperty("skip")),
                Limit = NullableInt(query.GetProperty("limit")),
                QueryMatcher = d => d.Age > minAge,
                SortComparator = (a, b) => a.Age != b.Age ? a.Age.CompareTo(b.Age) : string.CompareOrdinal(a.Id, b.Id),
                SortFieldsChanged = (prev, doc) => prev.Age != doc.Age,
            };
        }

        private static ChangeEvent<Doc> ToChangeEvent(JsonElement changeEvent)
        {
            var id = changeEvent.GetProperty("id").GetString()!;
            switch (changeEvent.GetProperty("operation").GetString())
            {
                case "INSERT":
                    return ChangeEvent<Doc>.Insert(id, ToDoc(changeEvent.GetProperty("doc")));
                case "UPDATE":
                    return ChangeEvent<Doc>.Update(id, ToDoc(changeEvent.GetProperty("doc")), ToDoc(changeEvent.GetProperty("previous")));
                default:
                    return ChangeEvent<Doc>.Delete(id, ToDoc(changeEvent.GetProperty("previous")));
            }
        }

        [Fact]
        public void SameStateSetAndActionAsTheJavaScriptImplementation()
        {
            using var json = JsonDocument.Parse(File.ReadAllText(CasesPath()));
            var cases = json.RootElement.EnumerateArray().ToList();
            Assert.True(cases.Count > 100);
            for (var index = 0; index < cases.Count; index++)
            {
                var testCase = cases[index];
                var input = new StateResolveFunctionInput<Doc>(
                    QueryParams(testCase.GetProperty("query")),
                    ToChangeEvent(testCase.GetProperty("changeEvent")),
                    testCase.GetProperty("previousResults").EnumerateArray().Select(ToDoc).ToList());
                Assert.True(
                    States.GetStateSet(input) == testCase.GetProperty("stateSet").GetString(),
                    $"state set of case #{index}");
                Assert.True(
                    EventReducer.CalculateActionName(input).ToJsName() == testCase.GetProperty("action").GetString(),
                    $"action of case #{index}");
            }
        }
    }
}
