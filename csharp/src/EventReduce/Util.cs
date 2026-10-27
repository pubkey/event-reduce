using System;
using System.Collections.Generic;

namespace EventReduce
{
    /// <summary>Helpers that are used by the states and actions.</summary>
    public static class Util
    {
        /// <summary>
        /// Returns the index of the document with the given id
        /// or -1 if it is not in the given documents.
        /// </summary>
        public static int IndexOfDocumentId<TDoc>(QueryParams<TDoc> queryParams, List<TDoc> docs, string id)
        {
            var getId = queryParams.GetDocumentId;
            for (var i = 0; i < docs.Count; i++)
            {
                if (getId(docs[i]) == id)
                {
                    return i;
                }
            }
            return -1;
        }

        /// <summary>
        /// Inserts the item at its sort position, which is much faster than re-sorting the list.
        /// Items that are equal to the new item stay before it.
        /// </summary>
        public static void PushAtSortPosition<TDoc>(List<TDoc> list, TDoc item, Comparison<TDoc> compare)
        {
            // Shortcut: the item belongs at the end, Add() is O(1).
            if (list.Count == 0 || compare(list[list.Count - 1], item) <= 0)
            {
                list.Add(item);
                return;
            }
            var low = 0;
            var high = list.Count;
            while (low < high)
            {
                var mid = (low + high) >> 1;
                if (compare(list[mid], item) <= 0)
                {
                    low = mid + 1;
                }
                else
                {
                    high = mid;
                }
            }
            list.Insert(low, item);
        }
    }
}
