using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using Xunit;

namespace EventReduce.Tests
{
    /// <summary>Runs the test suite that all implementations share, see ../test-suite/README.md.</summary>
    public class TestSuiteTests
    {
        public sealed record Doc(string Id, int Age, string Name);

        private static JsonNode Load(string file, [CallerFilePath] string path = "") =>
            JsonNode.Parse(File.ReadAllText(Path.Combine(Path.GetDirectoryName(path)!, "..", "..", "..", "test-suite", file)))!;

        private static Doc ToDoc(JsonNode? json) =>
            new(json!["id"]!.GetValue<string>(), json["age"]!.GetValue<int>(), json["name"]?.GetValue<string>() ?? "");

        private static List<Doc> ToDocs(JsonNode? json) => json!.AsArray().Select(ToDoc).ToList();

        private static JsonArray Ids(IEnumerable<Doc> docs) => new(docs.Select(d => (JsonNode?)JsonValue.Create(d.Id)).ToArray());

        private static void AssertJson(JsonNode? expected, JsonNode? actual, string context) =>
            Assert.True(JsonNode.DeepEquals(expected, actual), $"{context}: expected {expected?.ToJsonString()}, got {actual?.ToJsonString()}");

        private static QueryParams<Doc> QueryParams(JsonNode query)
        {
            var minAge = query["minAge"]!.GetValue<int>();
            var direction = query["desc"]?.GetValue<bool>() == true ? -1 : 1;
            return new QueryParams<Doc>
            {
                GetDocumentId = d => d.Id,
                Skip = query["skip"]?.GetValue<int>(),
                Limit = query["limit"]?.GetValue<int>(),
                QueryMatcher = d => d.Age > minAge,
                SortComparator = (a, b) => direction * (a.Age != b.Age ? a.Age.CompareTo(b.Age) : string.CompareOrdinal(a.Id, b.Id)),
                SortFieldsChanged = (previous, doc) => previous.Age != doc.Age,
            };
        }

        private static ChangeEvent<Doc> ToChangeEvent(JsonNode? json)
        {
            var id = json!["id"]!.GetValue<string>();
            switch (json["operation"]!.GetValue<string>())
            {
                case "INSERT": return ChangeEvent<Doc>.Insert(id, ToDoc(json["doc"]));
                case "UPDATE": return ChangeEvent<Doc>.Update(id, ToDoc(json["doc"]), ToDoc(json["previous"]));
                default: return ChangeEvent<Doc>.Delete(id, ToDoc(json["previous"]));
            }
        }

        private static int BufferSize(JsonNode? json) =>
            json!.GetValueKind() == System.Text.Json.JsonValueKind.String ? ResultWindowBuffer.AllRows : json.GetValue<int>();

        private static string LowerFirst(string name) => char.ToLowerInvariant(name[0]) + name.Substring(1);

        [Fact]
        public void StateSets()
        {
            var suite = Load("state-sets.json");
            Assert.True(suite["packedBddString"]!.GetValue<string>() == BddGenerated.PackedBddString, "BddGenerated.cs is out of sync with the JavaScript BDD");
            var index = 0;
            foreach (var testCase in suite["cases"]!.AsArray())
            {
                var input = new StateResolveFunctionInput<Doc>(
                    QueryParams(testCase!["query"]!), ToChangeEvent(testCase["changeEvent"]), ToDocs(testCase["previousResults"]));
                Assert.True(States.GetStateSet(input) == testCase["stateSet"]!.GetValue<string>(), $"state set of case #{index}");
                Assert.True(EventReducer.CalculateActionName(input).ToJsName() == testCase["action"]!.GetValue<string>(), $"action of case #{index}");
                index++;
            }
        }

        [Fact]
        public void Actions()
        {
            foreach (var testCase in Load("cases.json")["actions"]!.AsArray())
            {
                var name = testCase!["name"]!.GetValue<string>();
                var queryParams = QueryParams(testCase["query"]!);
                var changeEvent = ToChangeEvent(testCase["changeEvent"]);
                var results = ToDocs(testCase["previousResults"]);
                var keyDocumentMap = testCase["useKeyDocumentMap"]!.GetValue<bool>() ? results.ToDictionary(d => d.Id) : null;
                var actionName = testCase["action"]?.GetValue<string>();
                ActionName action;
                if (actionName != null)
                {
                    action = EventReduce.Actions.OrderedActionList.First(a => a.ToJsName() == actionName);
                }
                else
                {
                    action = EventReducer.CalculateActionName(new StateResolveFunctionInput<Doc>(queryParams, changeEvent, results, keyDocumentMap));
                    Assert.True(action.ToJsName() == testCase["expectedAction"]!.GetValue<string>(), name);
                }
                string? error = null;
                try
                {
                    EventReducer.RunAction(action, queryParams, changeEvent, results, keyDocumentMap);
                }
                catch (EventReduceException e)
                {
                    error = e.Code;
                }
                Assert.True(error == testCase["expectedError"]?.GetValue<string>(), $"{name}: error {error}");
                Assert.True(results.SequenceEqual(ToDocs(testCase["expectedResults"])), $"{name}: results");
                if (keyDocumentMap != null)
                {
                    Assert.True(
                        keyDocumentMap.Values.OrderBy(d => d.Id, StringComparer.Ordinal).SequenceEqual(ToDocs(testCase["expectedKeyDocumentMap"])),
                        $"{name}: key document map");
                }
            }
        }

        [Fact]
        public void ResultWindowBufferScenarios()
        {
            foreach (var scenario in Load("cases.json")["resultWindowBuffer"]!.AsArray())
            {
                var name = scenario!["name"]!.GetValue<string>();
                var buffer = new ResultWindowBuffer<Doc>(
                    QueryParams(scenario["query"]!), BufferSize(scenario["limitBufferSize"]), BufferSize(scenario["skipBufferSize"]));
                var index = 0;
                foreach (var step in scenario["steps"]!.AsArray())
                {
                    var op = step!["op"]!.GetValue<string>();
                    var context = $"{name}: step #{index} {op}";
                    switch (op)
                    {
                        case "query":
                            var query = buffer.GetQuery();
                            AssertJson(step["expected"], new JsonObject { ["skip"] = query.Skip, ["limit"] = query.Limit }, context);
                            break;
                        case "reset":
                            buffer.Reset(ToDocs(step["rows"]));
                            break;
                        case "results":
                            JsonNode? results = null;
                            string? error = null;
                            try
                            {
                                results = Ids(buffer.GetResults());
                            }
                            catch (EventReduceException e)
                            {
                                error = e.Code;
                            }
                            AssertJson(step["expected"], results, context);
                            Assert.True(error == step["expectedError"]?.GetValue<string>(), context);
                            break;
                        case "applyChangeEvent":
                            var result = buffer.ApplyChangeEvent(ToChangeEvent(step["changeEvent"]));
                            Assert.True(LowerFirst(result.ToString()) == step["expected"]!.GetValue<string>(), $"{context}: got {result}");
                            break;
                        case "applyChangeEvents":
                            var change = buffer.ApplyChangeEvents(step["changeEvents"]!.AsArray().Select(ToChangeEvent).ToList());
                            AssertJson(
                                step["expected"],
                                change.RunFullQueryAgain
                                    ? new JsonObject { ["runFullQueryAgain"] = true }
                                    : new JsonObject { ["runFullQueryAgain"] = false, ["changed"] = change.Changed, ["results"] = Ids(change.Results) },
                                context);
                            break;
                        case "inspect":
                            AssertJson(
                                step["expected"],
                                new JsonObject { ["buffer"] = Ids(buffer.Buffer), ["offset"] = buffer.Offset, ["complete"] = buffer.Complete },
                                context);
                            break;
                        default:
                            Assert.Fail($"{context}: unknown op");
                            break;
                    }
                    index++;
                }
            }
        }

        [Fact]
        public void RecommendedResultWindowBufferSize()
        {
            foreach (var pair in Load("cases.json")["recommendedResultWindowBufferSize"]!.AsArray())
            {
                var limit = pair![0]?.GetValue<int>();
                Assert.True(ResultWindowBuffer.GetRecommendedSize(limit) == pair[1]!.GetValue<int>(), $"limit {limit}");
            }
        }
    }
}
