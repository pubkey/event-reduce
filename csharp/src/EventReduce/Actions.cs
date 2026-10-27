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
        /// <summary>
        /// All actions, in the same order as the JavaScript implementation.
        /// The BDD references the actions by their index in this list.
        /// </summary>
        public static readonly IReadOnlyList<ActionName> OrderedActionList = (ActionName[])Enum.GetValues(typeof(ActionName));

        /// <summary>
        /// Returns the function of the given action.
        /// AlwaysWrong is only used by the truth-table generator and never
        /// returned by the BDD, so it is mapped to UnknownAction here.
        /// </summary>
        public static Action<StateResolveFunctionInput<TDoc>> GetActionFunction<TDoc>(ActionName action)
        {
            switch (action)
            {
                case ActionName.DoNothing: return DoNothing;
                case ActionName.InsertFirst: return InsertFirst;
                case ActionName.InsertLast: return InsertLast;
                case ActionName.RemoveFirstItem: return RemoveFirstItem;
                case ActionName.RemoveLastItem: return RemoveLastItem;
                case ActionName.RemoveFirstInsertLast: return RemoveFirstInsertLast;
                case ActionName.RemoveLastInsertFirst: return RemoveLastInsertFirst;
                case ActionName.RemoveFirstInsertFirst: return RemoveFirstInsertFirst;
                case ActionName.RemoveLastInsertLast: return RemoveLastInsertLast;
                case ActionName.RemoveExisting: return RemoveExisting;
                case ActionName.ReplaceExisting: return ReplaceExisting;
                case ActionName.InsertAtSortPosition: return InsertAtSortPosition;
                case ActionName.RemoveExistingAndInsertAtSortPosition: return RemoveExistingAndInsertAtSortPosition;
                case ActionName.InsertAtSortPositionRemoveLast: return InsertAtSortPositionRemoveLast;
                case ActionName.InsertAtSortPositionRemoveFirst: return InsertAtSortPositionRemoveFirst;
                case ActionName.RunFullQueryAgain: return RunFullQueryAgain;
                default: return UnknownAction;
            }
        }

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

        /// <summary>doNothing</summary>
        public static void DoNothing<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
        }

        /// <summary>insertFirst</summary>
        public static void InsertFirst<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var doc = ChangedDoc(input);
            input.PreviousResults.Insert(0, doc);
            if (input.KeyDocumentMap != null)
            {
                input.KeyDocumentMap[input.ChangeEvent.Id] = doc;
            }
        }

        /// <summary>insertLast</summary>
        public static void InsertLast<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var doc = ChangedDoc(input);
            input.PreviousResults.Add(doc);
            if (input.KeyDocumentMap != null)
            {
                input.KeyDocumentMap[input.ChangeEvent.Id] = doc;
            }
        }

        /// <summary>removeFirstItem</summary>
        public static void RemoveFirstItem<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var results = input.PreviousResults;
            if (results.Count == 0)
            {
                return;
            }
            var first = results[0];
            results.RemoveAt(0);
            input.KeyDocumentMap?.Remove(input.QueryParams.GetDocumentId(first));
        }

        /// <summary>removeLastItem</summary>
        public static void RemoveLastItem<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var results = input.PreviousResults;
            if (results.Count == 0)
            {
                return;
            }
            var last = results[results.Count - 1];
            results.RemoveAt(results.Count - 1);
            input.KeyDocumentMap?.Remove(input.QueryParams.GetDocumentId(last));
        }

        /// <summary>removeFirstInsertLast</summary>
        public static void RemoveFirstInsertLast<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveFirstItem(input);
            InsertLast(input);
        }

        /// <summary>removeLastInsertFirst</summary>
        public static void RemoveLastInsertFirst<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveLastItem(input);
            InsertFirst(input);
        }

        /// <summary>removeFirstInsertFirst</summary>
        public static void RemoveFirstInsertFirst<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveFirstItem(input);
            InsertFirst(input);
        }

        /// <summary>removeLastInsertLast</summary>
        public static void RemoveLastInsertLast<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            RemoveLastItem(input);
            InsertLast(input);
        }

        /// <summary>removeExisting</summary>
        public static void RemoveExisting<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var index = FindIndexOfChangedDoc(input);
            input.KeyDocumentMap?.Remove(input.ChangeEvent.Id);
            if (index >= 0)
            {
                input.PreviousResults.RemoveAt(index);
            }
        }

        /// <summary>replaceExisting</summary>
        public static void ReplaceExisting<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var index = FindIndexOfChangedDoc(input);
            if (index < 0)
            {
                return;
            }
            var doc = ChangedDoc(input);
            input.PreviousResults[index] = doc;
            if (input.KeyDocumentMap != null)
            {
                input.KeyDocumentMap[input.ChangeEvent.Id] = doc;
            }
        }

        /// <summary>insertAtSortPosition</summary>
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
            if (map != null)
            {
                map[id] = doc;
            }
            Util.PushAtSortPosition(input.PreviousResults, doc, input.QueryParams.SortComparator);
        }

        /// <summary>removeExistingAndInsertAtSortPosition</summary>
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
        public static void InsertAtSortPositionRemoveLast<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var countBefore = input.PreviousResults.Count;
            InsertAtSortPosition(input);
            // InsertAtSortPosition() does nothing if the document is already in the results
            if (input.PreviousResults.Count > countBefore)
            {
                RemoveLastItem(input);
            }
        }

        /// <summary>
        /// Inserts the document at its sort position and then removes the first document.
        /// Used when a document moves out of the skipped documents into the results,
        /// so the previous first document is pushed into the skipped documents.
        /// </summary>
        public static void InsertAtSortPositionRemoveFirst<TDoc>(StateResolveFunctionInput<TDoc> input)
        {
            var countBefore = input.PreviousResults.Count;
            InsertAtSortPosition(input);
            // InsertAtSortPosition() does nothing if the document is already in the results
            if (input.PreviousResults.Count > countBefore)
            {
                RemoveFirstItem(input);
            }
        }

        /// <summary>runFullQueryAgain, always throws.</summary>
        public static void RunFullQueryAgain<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            throw new EventReduceException("RUN_FULL");

        /// <summary>unknownAction, always throws.</summary>
        public static void UnknownAction<TDoc>(StateResolveFunctionInput<TDoc> input) =>
            throw new EventReduceException("UNK_ACT");
    }
}
