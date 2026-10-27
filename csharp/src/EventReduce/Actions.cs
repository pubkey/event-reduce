using System;
using System.Collections.Generic;

namespace EventReduce
{
    /// <summary>
    /// The action functions.
    /// For performance reasons, they mutate the results and the key document map of the input.
    /// </summary>
    public static class Actions
    {
        /// <summary>The array behind <see cref="OrderedActionList"/>, avoids interface calls on the hot path.</summary>
        internal static readonly ActionName[] OrderedActions = (ActionName[])Enum.GetValues(typeof(ActionName));

        /// <summary>
        /// All actions, in the same order as the JavaScript implementation.
        /// The BDD references the actions by their index in this list.
        /// </summary>
        public static readonly IReadOnlyList<ActionName> OrderedActionList = OrderedActions;

        /// <summary>The cached delegates of the action functions, indexed by (int)ActionName.</summary>
        private static class ActionTable<TDoc>
        {
            internal static readonly Action<StateResolveFunctionInput<TDoc>>[] Functions =
            {
                DoNothing,
                InsertFirst,
                InsertLast,
                RemoveFirstItem,
                RemoveLastItem,
                RemoveFirstInsertLast,
                RemoveLastInsertFirst,
                RemoveFirstInsertFirst,
                RemoveLastInsertLast,
                RemoveExisting,
                ReplaceExisting,
                UnknownAction, // AlwaysWrong
                InsertAtSortPosition,
                RemoveExistingAndInsertAtSortPosition,
                InsertAtSortPositionRemoveLast,
                InsertAtSortPositionRemoveFirst,
                RunFullQueryAgain,
                UnknownAction,
            };
        }

        /// <summary>
        /// Returns the function of the given action.
        /// AlwaysWrong is only used by the truth-table generator and never
        /// returned by the BDD, so it is mapped to UnknownAction here.
        /// </summary>
        public static Action<StateResolveFunctionInput<TDoc>> GetActionFunction<TDoc>(ActionName action)
        {
            var functions = ActionTable<TDoc>.Functions;
            var index = (int)action;
            return functions[(uint)index < (uint)functions.Length ? index : (int)ActionName.UnknownAction];
        }

        /// <summary>Runs the function of the given action on the input.</summary>
        internal static void Run<TDoc>(ActionName action, StateResolveFunctionInput<TDoc> input) =>
            GetActionFunction<TDoc>(action)(input);

        /// <summary>Returns the index of the changed document inside of the previous results or -1.</summary>
        private static int FindIndexOfChangedDoc<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var id = input.ChangeEvent.Id;
            if (input.KeyDocumentMap != null && !input.KeyDocumentMap.ContainsKey(id))
            {
                return -1;
            }
            return Util.IndexOfDocumentId(input.QueryParams, input.PreviousResults, id);
        }

        /// <summary>
        /// The new document of the change event.
        /// Only the BDD knows that it exists for the given action.
        /// </summary>
        private static TDoc ChangedDoc<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            if (!input.ChangeEvent.HasDoc)
            {
                throw new EventReduceException("UNK_ACT");
            }
            return input.ChangeEvent.Doc;
        }

        private static void AddToMap<TDoc>(StateResolveFunctionInput<TDoc> input, TDoc doc)
        {
            if (input.KeyDocumentMap != null)
            {
                input.KeyDocumentMap[input.ChangeEvent.Id] = doc;
            }
        }

        private static void RemoveFromMap<TDoc>(StateResolveFunctionInput<TDoc> input, TDoc doc) =>
            input.KeyDocumentMap?.Remove(input.QueryParams.GetDocumentId(doc));

        public static void DoNothing<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
        }

        public static void InsertFirst<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var doc = ChangedDoc(input);
            input.PreviousResults.Insert(0, doc);
            AddToMap(input, doc);
        }

        public static void InsertLast<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var doc = ChangedDoc(input);
            input.PreviousResults.Add(doc);
            AddToMap(input, doc);
        }

        public static void RemoveFirstItem<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var results = input.PreviousResults;
            if (results.Count == 0)
            {
                return;
            }
            var first = results[0];
            results.RemoveAt(0);
            RemoveFromMap(input, first);
        }

        public static void RemoveLastItem<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var results = input.PreviousResults;
            if (results.Count == 0)
            {
                return;
            }
            var last = results[results.Count - 1];
            results.RemoveAt(results.Count - 1);
            RemoveFromMap(input, last);
        }

        public static void RemoveFirstInsertLast<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveFirstItem(input);
            InsertLast(input);
        }

        public static void RemoveLastInsertFirst<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveLastItem(input);
            InsertFirst(input);
        }

        public static void RemoveFirstInsertFirst<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveFirstItem(input);
            InsertFirst(input);
        }

        public static void RemoveLastInsertLast<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveLastItem(input);
            InsertLast(input);
        }

        public static void RemoveExisting<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var index = FindIndexOfChangedDoc(input);
            input.KeyDocumentMap?.Remove(input.ChangeEvent.Id);
            if (index >= 0)
            {
                input.PreviousResults.RemoveAt(index);
            }
        }

        public static void ReplaceExisting<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var index = FindIndexOfChangedDoc(input);
            if (index < 0)
            {
                return;
            }
            var doc = ChangedDoc(input);
            input.PreviousResults[index] = doc;
            AddToMap(input, doc);
        }

        public static void InsertAtSortPosition<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var doc = ChangedDoc(input);
            var id = input.ChangeEvent.Id;
            var map = input.KeyDocumentMap;
            // If document is already in results,
            // we cannot add it again because it would throw on non-deterministic ordering.
            var isDocInResults = map != null
                ? map.ContainsKey(id)
                : Util.IndexOfDocumentId(input.QueryParams, input.PreviousResults, id) >= 0;
            if (isDocInResults)
            {
                return;
            }
            AddToMap(input, doc);
            Util.PushAtSortPosition(input.PreviousResults, doc, input.QueryParams.SortComparator);
        }

        public static void RemoveExistingAndInsertAtSortPosition<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveExisting(input);
            InsertAtSortPosition(input);
        }

        /// <summary>
        /// Inserts the document at its sort position and then removes the last document.
        /// Used when the limit was reached and the new document
        /// sorts in between the first and the last document,
        /// so the previous last document is pushed out of the results.
        /// </summary>
        public static void InsertAtSortPositionRemoveLast<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            InsertAtSortPositionAndRemove(input, removeFirst: false);

        /// <summary>
        /// Inserts the document at its sort position and then removes the first document.
        /// Used when a document moves out of the skipped documents into the results,
        /// so the previous first document is pushed into the skipped documents.
        /// </summary>
        public static void InsertAtSortPositionRemoveFirst<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            InsertAtSortPositionAndRemove(input, removeFirst: true);

        private static void InsertAtSortPositionAndRemove<TDoc>(StateResolveFunctionInput<TDoc> input, bool removeFirst)
        {
            var countBefore = input.PreviousResults.Count;
            InsertAtSortPosition(input);
            // InsertAtSortPosition() does nothing if the document is already in the results
            if (input.PreviousResults.Count > countBefore)
            {
                if (removeFirst)
                {
                    RemoveFirstItem(input);
                }
                else
                {
                    RemoveLastItem(input);
                }
            }
        }

        /// <summary>Always throws an <see cref="EventReduceException"/> with the code RUN_FULL.</summary>
        public static void RunFullQueryAgain<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            throw new EventReduceException("RUN_FULL");

        /// <summary>Always throws an <see cref="EventReduceException"/> with the code UNK_ACT.</summary>
        public static void UnknownAction<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            throw new EventReduceException("UNK_ACT");
    }
}
