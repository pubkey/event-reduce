using System;
using System.Collections.Generic;
using System.Text;

namespace RxDB.EventReduce
{
    /// <summary>The state functions, each one returns a boolean for the input.</summary>
    public static class States
    {
        /// <summary>
        /// All states, in the same order as the JavaScript implementation.
        /// The BDD references the states by their index in this list.
        /// </summary>
        public static readonly IReadOnlyList<StateName> OrderedStateList = (StateName[])Enum.GetValues(typeof(StateName));

        public static bool HasLimit<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.QueryParams.Limit is int limit && limit > 0;

        public static bool IsFindOne<TDoc>(StateResolveFunctionInput<TDoc> input) => input.QueryParams.Limit == 1;

        public static bool HasSkip<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.QueryParams.Skip is int skip && skip > 0;

        public static bool IsDelete<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.ChangeEvent.Operation == WriteOperation.Delete;

        public static bool IsInsert<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.ChangeEvent.Operation == WriteOperation.Insert;

        public static bool IsUpdate<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.ChangeEvent.Operation == WriteOperation.Update;

        public static bool WasLimitReached<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.QueryParams.Limit is int limit && limit > 0 && input.PreviousResults.Count >= limit;

        public static bool SortParamsChanged<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var changeEvent = input.ChangeEvent;
            if (!changeEvent.HasDoc)
            {
                return false;
            }
            if (!changeEvent.HasPrevious)
            {
                return true;
            }
            return input.QueryParams.SortFieldsChanged(changeEvent.Previous, changeEvent.Doc);
        }

        public static bool WasInResult<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var id = input.ChangeEvent.Id;
            if (input.KeyDocumentMap != null)
            {
                return input.KeyDocumentMap.ContainsKey(id);
            }
            return Util.IndexOfDocumentId(input.QueryParams, input.PreviousResults, id) >= 0;
        }

        public static bool WasFirst<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var results = input.PreviousResults;
            return results.Count > 0 && input.QueryParams.GetDocumentId(results[0]) == input.ChangeEvent.Id;
        }

        public static bool WasLast<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var results = input.PreviousResults;
            return results.Count > 0 &&
                input.QueryParams.GetDocumentId(results[results.Count - 1]) == input.ChangeEvent.Id;
        }

        /// <summary>
        /// Compares the previous document with the first or last result item.
        /// If the changed document is the result item itself,
        /// we cannot sort-compare them, because it might end in a non-deterministic
        /// sort order. Because both document could be equal.
        /// So instead we have to return true.
        /// </summary>
        private static bool ComparePreviousWithResult<TDoc>(
            StateResolveFunctionInput<TDoc> input, bool first, Func<int, bool> expected)
        {
            var results = input.PreviousResults;
            if (!input.ChangeEvent.HasPrevious || results.Count == 0)
            {
                return false;
            }
            var resultItem = first ? results[0] : results[results.Count - 1];
            if (input.QueryParams.GetDocumentId(resultItem) == input.ChangeEvent.Id)
            {
                return true;
            }
            return expected(input.QueryParams.SortComparator(input.ChangeEvent.Previous, resultItem));
        }

        /// <summary>
        /// Compares the new document with the first or last result item.
        /// If the changed document is the result item itself,
        /// it compares with the neighbor of the result item instead,
        /// so we know if the changed document still sorts first or last.
        /// If there is no neighbor, the changed document is still first or last.
        /// </summary>
        private static bool CompareDocWithResult<TDoc>(
            StateResolveFunctionInput<TDoc> input, bool first, Func<int, bool> expected)
        {
            var results = input.PreviousResults;
            if (!input.ChangeEvent.HasDoc || results.Count == 0)
            {
                return false;
            }
            var resultItem = first ? results[0] : results[results.Count - 1];
            if (input.QueryParams.GetDocumentId(resultItem) == input.ChangeEvent.Id)
            {
                if (results.Count < 2)
                {
                    return true;
                }
                resultItem = first ? results[1] : results[results.Count - 2];
            }
            return expected(input.QueryParams.SortComparator(input.ChangeEvent.Doc, resultItem));
        }

        public static bool WasSortedBeforeFirst<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            ComparePreviousWithResult(input, true, c => c < 0);

        public static bool WasSortedAfterLast<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            ComparePreviousWithResult(input, false, c => c > 0);

        public static bool IsSortedBeforeFirst<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            CompareDocWithResult(input, true, c => c < 0);

        public static bool IsSortedAfterLast<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            CompareDocWithResult(input, false, c => c > 0);

        public static bool WasMatching<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.ChangeEvent.HasPrevious && input.QueryParams.QueryMatcher(input.ChangeEvent.Previous);

        public static bool DoesMatchNow<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.ChangeEvent.HasDoc && input.QueryParams.QueryMatcher(input.ChangeEvent.Doc);

        public static bool WasResultsEmpty<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            input.PreviousResults.Count == 0;

        /// <summary>Resolves the state with the given index in <see cref="OrderedStateList"/>.</summary>
        public static bool ResolveStateByIndex<TDoc>(int index, StateResolveFunctionInput<TDoc> input)
        {
            switch (index)
            {
                case 0: return IsInsert(input);
                case 1: return IsUpdate(input);
                case 2: return IsDelete(input);
                case 3: return HasLimit(input);
                case 4: return IsFindOne(input);
                case 5: return HasSkip(input);
                case 6: return WasResultsEmpty(input);
                case 7: return WasLimitReached(input);
                case 8: return WasFirst(input);
                case 9: return WasLast(input);
                case 10: return SortParamsChanged(input);
                case 11: return WasInResult(input);
                case 12: return WasSortedBeforeFirst(input);
                case 13: return WasSortedAfterLast(input);
                case 14: return IsSortedBeforeFirst(input);
                case 15: return IsSortedAfterLast(input);
                case 16: return WasMatching(input);
                case 17: return DoesMatchNow(input);
                default: throw new EventReduceException("UNK_STATE " + index);
            }
        }

        /// <summary>Resolves the given state.</summary>
        public static bool ResolveState<TDoc>(StateName state, StateResolveFunctionInput<TDoc> input) =>
            ResolveStateByIndex((int)state, input);

        /// <summary>
        /// Returns the binary representation of all states
        /// like '010110110111...' where the first '0' means that the first state is false.
        /// </summary>
        public static string GetStateSet<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var count = OrderedStateList.Count;
            var set = new StringBuilder(count);
            for (var i = 0; i < count; i++)
            {
                set.Append(ResolveStateByIndex(i, input) ? '1' : '0');
            }
            return set.ToString();
        }
    }
}
