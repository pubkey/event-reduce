using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.Json.Nodes;
using Xunit;

namespace RxDB.EventReduce.Tests
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

        [Fact]
        public void StateSets()
        {
            var suite = Load("state-sets.json");
            // BddGenerated.cs must be in sync with the JavaScript BDD
            Assert.Equal(suite["packedBdd"]!.AsArray().Select(e => e!.GetValue<int>()), BddGenerated.PackedBdd);
            var cases = suite["cases"]!.AsArray();
            for (var index = 0; index < cases.Count; index++)
            {
                var testCase = cases[index]!;
                var input = new StateResolveFunctionInput<Doc>(
                    QueryParams(testCase["query"]!), ToChangeEvent(testCase["changeEvent"]), ToDocs(testCase["previousResults"]));
                var expected = (testCase["stateSet"]!.GetValue<string>(), testCase["action"]!.GetValue<string>());
                Assert.Equal((index, expected), (index, (States.GetStateSet(input), EventReducer.CalculateActionName(input).ToJsName())));
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
                    action = RxDB.EventReduce.Actions.OrderedActionList.First(a => a.ToJsName() == actionName);
                }
                else
                {
                    action = EventReducer.CalculateActionName(new StateResolveFunctionInput<Doc>(queryParams, changeEvent, results, keyDocumentMap));
                    Assert.Equal((name, testCase["expectedAction"]!.GetValue<string>()), (name, action.ToJsName()));
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
                Assert.Equal((name, testCase["expectedError"]?.GetValue<string>()), (name, error));
                Assert.Equal(ToDocs(testCase["expectedResults"]), results);
                if (keyDocumentMap != null)
                {
                    Assert.Equal(ToDocs(testCase["expectedKeyDocumentMap"]), keyDocumentMap.Values.OrderBy(d => d.Id, StringComparer.Ordinal));
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
                var steps = scenario["steps"]!.AsArray();
                for (var index = 0; index < steps.Count; index++)
                {
                    var step = steps[index]!;
                    var op = step["op"]!.GetValue<string>();
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
                            Assert.Equal((context, step["expectedError"]?.GetValue<string>()), (context, error));
                            break;
                        case "applyChangeEvent":
                            var result = buffer.ApplyChangeEvent(ToChangeEvent(step["changeEvent"]));
                            Assert.Equal((context, step["expected"]!.GetValue<string>()), (context, result.ToJsName()));
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
                }
            }
        }

        [Fact]
        public void RecommendedResultWindowBufferSize()
        {
            foreach (var pair in Load("cases.json")["recommendedResultWindowBufferSize"]!.AsArray())
            {
                var limit = pair![0]?.GetValue<int>();
                Assert.Equal((limit, pair[1]!.GetValue<int>()), (limit, ResultWindowBuffer.GetRecommendedSize(limit)));
            }
        }
    }
}
