using System.IO;
using System.Linq;
using System.Runtime.CompilerServices;
using Xunit;
using static EventReduce.Tests.Helper;

namespace EventReduce.Tests
{
    public class BddTests
    {
        private static string RepositoryRoot([CallerFilePath] string path = "") =>
            Path.GetFullPath(Path.Combine(Path.GetDirectoryName(path)!, "..", "..", ".."));

        [Fact]
        public void PackedBddStringIsTheSameAsInTheJavaScriptImplementation()
        {
            var js = File.ReadAllText(Path.Combine(RepositoryRoot(), "javascript", "src", "bdd", "bdd.generated.ts"));
            Assert.True(
                js.Contains("export const packedBddString = '" + BddGenerated.PackedBddString + "';"),
                "csharp BddGenerated.cs is out of sync with the JavaScript BDD");
        }

        [Fact]
        public void PackedBddOnlyReferencesKnownStatesAndActions()
        {
            var bdd = Bdd.PackedBdd;
            Assert.Equal(0, bdd.Length % 3);
            var n = bdd.Length / 3;
            for (var i = 0; i < bdd.Length; i += 3)
            {
                Assert.True(bdd[i] < States.OrderedStateList.Count);
                foreach (var reference in new[] { bdd[i + 1], bdd[i + 2] })
                {
                    Assert.True(reference < n || reference - n < Actions.OrderedActionList.Count);
                }
            }
        }

        [Fact]
        public void InsertIntoEmptyResultsWithoutLimit()
        {
            var action = EventReducer.CalculateActionName(Input(QueryParams(10), Insert(new Human("a", 20)), Enumerable.Empty<Human>()));
            Assert.Equal(ActionName.InsertFirst, action);
        }

        [Fact]
        public void InsertOfNonMatchingDocumentDoesNothing()
        {
            var action = EventReducer.CalculateActionName(Input(QueryParams(10), Insert(new Human("a", 5)), new[] { new Human("b", 20) }));
            Assert.Equal(ActionName.DoNothing, action);
        }
    }
}
