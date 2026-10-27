using System;
using System.Collections.Generic;

namespace EventReduce
{
    // Result window buffer
    // ------------
    // For a query with a limit or a skip, EventReduce returns RunFullQueryAgain
    // when a row has to move into the result window that is not in the previous results:
    // the row after the last row (a row left a full window) or the last skipped row
    // (a row was added in front of the window).
    // The result window buffer keeps rows on both sides of the window in memory,
    // so these rows can be taken from memory instead.
    // See docs/result-window-buffer.md for the explanation and measurements.
    //
    // Invariant: Buffer is always an exact, contiguous slice of the full sorted result
    // (without skip and limit): exactly Offset matching rows sort before its first row,
    // and it never contains a wrong row or misses a row in between.
    // If Complete is true, there are no rows after its last row.
    // Only if the buffer is empty, Offset can be larger than the real number of rows.

    /// <summary>What <see cref="ResultWindowBuffer{TDoc}.ApplyChangeEvent"/> did.</summary>
    public enum ResultWindowBufferResult
    {
        /// <summary>An EventReduce action calculated the new buffer.</summary>
        EventReduce,
        /// <summary>EventReduce could not do it (or would have dropped a row), the slice rule did it.</summary>
        Buffer,
        /// <summary>
        /// The caller must run the query with the skip and limit of GetQuery()
        /// and pass the rows to Reset().
        /// </summary>
        RunFullQueryAgain,
    }

    /// <summary>
    /// The skip and limit to run the query of the buffer with.
    /// <see cref="Limit"/> is null if all rows after the skip are needed.
    /// </summary>
    public readonly struct ResultWindowBufferQuery : IEquatable<ResultWindowBufferQuery>
    {
        /// <summary>The number of rows to skip.</summary>
        public int Skip { get; }

        /// <summary>The maximum number of rows, null for all rows after the skip.</summary>
        public int? Limit { get; }

        /// <summary>Creates the query.</summary>
        public ResultWindowBufferQuery(int skip, int? limit)
        {
            Skip = skip;
            Limit = limit;
        }

        /// <inheritdoc/>
        public bool Equals(ResultWindowBufferQuery other) => Skip == other.Skip && Limit == other.Limit;

        /// <inheritdoc/>
        public override bool Equals(object? obj) => obj is ResultWindowBufferQuery other && Equals(other);

        /// <inheritdoc/>
        public override int GetHashCode() => HashCode.Combine(Skip, Limit);

        /// <inheritdoc/>
        public override string ToString() => $"ResultWindowBufferQuery(Skip: {Skip}, Limit: {Limit})";
    }

    /// <summary>
    /// What <see cref="ResultWindowBuffer{TDoc}.ApplyChangeEvents"/> returns.
    /// <see cref="Results"/> are the rows of the original skip and limit,
    /// <see cref="Changed"/> is true if they are not the same rows as before the change events.
    /// If <see cref="RunFullQueryAgain"/> is true, run the query of GetQuery() and pass the rows to Reset().
    /// </summary>
    public sealed class ResultWindowBufferChangeResult<TDoc>
    {
        /// <summary>True if the query must run again.</summary>
        public bool RunFullQueryAgain { get; }

        /// <summary>True if the results are not the same rows as before the change events.</summary>
        public bool Changed { get; }

        /// <summary>The rows of the original skip and limit, empty if RunFullQueryAgain.</summary>
        public IReadOnlyList<TDoc> Results { get; }

        internal ResultWindowBufferChangeResult(bool runFullQueryAgain, bool changed, IReadOnlyList<TDoc> results)
        {
            RunFullQueryAgain = runFullQueryAgain;
            Changed = changed;
            Results = results;
        }
    }

    /// <summary>Helpers of the result window buffer that do not depend on the document type.</summary>
    public static class ResultWindowBuffer
    {
        /// <summary>Pass it as a buffer size to keep all rows on that side of the result window.</summary>
        public const int AllRows = int.MaxValue;

        /// <summary>
        /// Buffer sizes from this value on keep all rows.
        /// Keeps the arithmetic far away from an overflow.
        /// </summary>
        internal const int MaxBufferSize = 1 << 29;

        /// <summary>
        /// The recommended buffer size for each side of the result window.
        /// About log2(limit) for small limits, grows faster around limit 400 and is at most 30.
        /// Returns 0 for a limit of 1 (like a find-one query) and for queries without a limit.
        /// </summary>
        public static int GetRecommendedSize(int? limit)
        {
            if (limit == null || limit == 0)
            {
                return 0;
            }
            var ratio = 400.0 / limit.Value;
            var size = Math.Log(limit.Value, 2) + 19.0 / (1.0 + ratio * ratio);
            return Math.Min(30, (int)Math.Floor(size));
        }
    }

    /// <summary>
    /// Keeps rows on both sides of the result window of a query with a skip or limit in memory,
    /// so most changes that EventReduce alone cannot handle are served from memory.
    /// Create it, run the query with the skip and limit of <see cref="GetQuery"/>
    /// and pass the rows to <see cref="Reset"/> before using it.
    /// </summary>
    public sealed class ResultWindowBuffer<TDoc>
    {
        /// <summary>
        /// Actions that keep the length of the result by dropping its first or last row.
        /// The slice rule can keep that row instead.
        /// </summary>
        private static readonly HashSet<ActionName> ActionsThatDropARow = new HashSet<ActionName>
        {
            ActionName.RemoveFirstItem,
            ActionName.RemoveLastItem,
            ActionName.RemoveFirstInsertLast,
            ActionName.RemoveLastInsertFirst,
            ActionName.RemoveFirstInsertFirst,
            ActionName.RemoveLastInsertLast,
            ActionName.InsertAtSortPositionRemoveLast,
            ActionName.InsertAtSortPositionRemoveFirst,
        };

        /// <summary>QueryParams of the original query, with the skip and limit that are shown to the user.</summary>
        public QueryParams<TDoc> QueryParams { get; }

        /// <summary>Amount of rows to keep after the last row of the result window.</summary>
        public int LimitBufferSize { get; }

        /// <summary>Amount of rows to keep before the first row of the result window, out of the skipped rows.</summary>
        public int SkipBufferSize { get; }

        private List<TDoc> buffer = new List<TDoc>();
        private readonly Dictionary<string, TDoc> keyDocumentMap = new Dictionary<string, TDoc>();

        /// <summary>All rows that are kept in memory, the result window and the rows around it.</summary>
        public IReadOnlyList<TDoc> Buffer => buffer;

        /// <summary>Map from the id of each row in the buffer to the row.</summary>
        public IReadOnlyDictionary<string, TDoc> KeyDocumentMap => keyDocumentMap;

        /// <summary>Number of matching rows that sort before the first row of the buffer.</summary>
        public int Offset { get; private set; }

        /// <summary>True if there are no rows after the last row of the buffer.</summary>
        public bool Complete { get; private set; }

        /// <summary>
        /// Creates an empty result window buffer.
        /// <paramref name="queryParams"/> has the skip and limit that are shown to the user.
        /// <see cref="ResultWindowBuffer.AllRows"/> as a size keeps all rows on that side.
        /// Throws on negative sizes.
        /// </summary>
        public ResultWindowBuffer(QueryParams<TDoc> queryParams, int limitBufferSize = 0, int skipBufferSize = 0)
        {
            if (limitBufferSize < 0 || skipBufferSize < 0)
            {
                throw new EventReduceException("RWB_SIZE");
            }
            // with limit 0 the result is always empty, so no rows are kept
            var isEmptyQuery = queryParams.Limit == 0;
            QueryParams = queryParams;
            LimitBufferSize = isEmptyQuery ? 0 : Math.Min(limitBufferSize, ResultWindowBuffer.MaxBufferSize);
            SkipBufferSize = isEmptyQuery ? 0 : Math.Min(skipBufferSize, ResultWindowBuffer.MaxBufferSize);
        }

        private int GetSkip() => QueryParams.Skip ?? 0;

        /// <summary>The skip and limit to run the query of the buffer with.</summary>
        public ResultWindowBufferQuery GetQuery()
        {
            var skip = GetSkip();
            var bufferSkip = Math.Max(0, skip - SkipBufferSize);
            int? bufferLimit = null;
            if (QueryParams.Limit is int limit && LimitBufferSize < ResultWindowBuffer.MaxBufferSize)
            {
                var sum = (long)(skip - bufferSkip) + limit + LimitBufferSize;
                bufferLimit = sum <= int.MaxValue ? (int?)sum : null;
            }
            return new ResultWindowBufferQuery(bufferSkip, bufferLimit);
        }

        /// <summary>
        /// Set the buffer to the rows of a fresh query
        /// that ran with the skip and limit of <see cref="GetQuery"/>.
        /// </summary>
        public void Reset(IEnumerable<TDoc> rows)
        {
            var query = GetQuery();
            buffer = new List<TDoc>(rows);
            keyDocumentMap.Clear();
            foreach (var doc in buffer)
            {
                keyDocumentMap[QueryParams.GetDocumentId(doc)] = doc;
            }
            Offset = query.Skip;
            // fewer rows than requested means there are no more rows
            Complete = query.Limit == null || buffer.Count < query.Limit.Value;
        }

        /// <summary>
        /// The result that is shown to the user.
        /// Throws if the result window is not in the buffer, which happens
        /// before Reset() was called or when ApplyChangeEvent() returned RunFullQueryAgain
        /// and the query did not run again.
        /// </summary>
        public List<TDoc> GetResults()
        {
            if (!IsResultWindowInBuffer())
            {
                throw new EventReduceException("RWB_OUTDATED");
            }
            var start = Math.Min(GetSkip() - Offset, buffer.Count);
            var end = QueryParams.Limit is int limit ? (int)Math.Min((long)start + limit, buffer.Count) : buffer.Count;
            return buffer.GetRange(start, end - start);
        }

        /// <summary>Updates the buffer with the change event.</summary>
        public ResultWindowBufferResult ApplyChangeEvent(ChangeEvent<TDoc> changeEvent)
        {
            if (QueryParams.Limit == 0)
            {
                // the result of a query with limit 0 is always empty, nothing can change it
                return ResultWindowBufferResult.EventReduce;
            }
            if (!Complete && buffer.Count == 0)
            {
                return ResultWindowBufferResult.RunFullQueryAgain;
            }

            // 1. Let EventReduce handle the buffer as if it was the result of a query
            // with skip = Offset and limit = buffer.Count. This is exactly true,
            // because the buffer is an exact slice of the full result.
            // If the buffer is complete, we use buffer.Count + 1, so EventReduce
            // knows that the limit is not reached and there are no more rows.
            var input = new StateResolveFunctionInput<TDoc>(
                QueryParams.WithSkipAndLimit(Offset > 0 ? (int?)Offset : null, Complete ? buffer.Count + 1 : buffer.Count),
                changeEvent,
                buffer,
                keyDocumentMap);
            var action = EventReducer.CalculateActionName(input);
            ResultWindowBufferResult result;
            if (action == ActionName.RunFullQueryAgain ||
                action == ActionName.UnknownAction ||
                ActionsThatDropARow.Contains(action))
            {
                // 2. EventReduce needs a row before or after the buffer, which it does not know,
                // or it would drop a row to keep the length of the result.
                // But the buffer does not have to keep its length, only to stay an exact slice,
                // so the slice rule lets it shrink or grow instead.
                ApplySliceRule(changeEvent);
                result = ResultWindowBufferResult.Buffer;
            }
            else
            {
                Actions.GetActionFunction<TDoc>(action)(input);
                result = ResultWindowBufferResult.EventReduce;
            }

            // 3. Do not let the buffer grow without bounds on either side.
            Trim();

            // 4. Run the query again if the result window does not fit into the buffer anymore.
            if (!IsResultWindowInBuffer())
            {
                return ResultWindowBufferResult.RunFullQueryAgain;
            }
            return result;
        }

        /// <summary>
        /// Updates the buffer with all change events.
        /// Returns the new results, and if they changed,
        /// or RunFullQueryAgain if the result window does not fit into the buffer anymore.
        /// Then run the query of GetQuery() and pass the rows to Reset().
        /// Rows are compared with <see cref="EqualityComparer{T}.Default"/>, which compares
        /// classes by reference, like the JavaScript implementation, and structs by value.
        /// </summary>
        public ResultWindowBufferChangeResult<TDoc> ApplyChangeEvents(IEnumerable<ChangeEvent<TDoc>> changeEvents)
        {
            var runFullQueryAgain = new ResultWindowBufferChangeResult<TDoc>(true, false, Array.Empty<TDoc>());
            if (!IsResultWindowInBuffer())
            {
                return runFullQueryAgain;
            }
            var previousResults = GetResults();
            foreach (var changeEvent in changeEvents)
            {
                if (ApplyChangeEvent(changeEvent) == ResultWindowBufferResult.RunFullQueryAgain)
                {
                    return runFullQueryAgain;
                }
            }
            var results = GetResults();
            var comparer = EqualityComparer<TDoc>.Default;
            var changed = results.Count != previousResults.Count;
            for (var index = 0; !changed && index < results.Count; index++)
            {
                changed = !comparer.Equals(results[index], previousResults[index]);
            }
            return new ResultWindowBufferChangeResult<TDoc>(false, changed, results);
        }

        /// <summary>True if all rows of the result window are in the buffer.</summary>
        private bool IsResultWindowInBuffer()
        {
            var start = GetSkip() - Offset;
            if (start < 0)
            {
                return false;
            }
            if (Complete)
            {
                return true;
            }
            return QueryParams.Limit is int limit && buffer.Count >= (long)start + limit;
        }

        /// <summary>
        /// Removes rows before the window that are more than SkipBufferSize
        /// and rows after the window that are more than LimitBufferSize.
        /// </summary>
        private void Trim()
        {
            var rowsBeforeWindow = GetSkip() - Offset;
            var removeFromStart = Math.Min(rowsBeforeWindow - SkipBufferSize, buffer.Count);
            if (removeFromStart > 0)
            {
                for (var i = 0; i < removeFromStart; i++)
                {
                    keyDocumentMap.Remove(QueryParams.GetDocumentId(buffer[i]));
                }
                buffer.RemoveRange(0, removeFromStart);
                Offset += removeFromStart;
            }

            if (QueryParams.Limit is int limit)
            {
                var maxLength = (long)Math.Max(0, GetSkip() - Offset) + limit + LimitBufferSize;
                if (buffer.Count > maxLength)
                {
                    var max = (int)maxLength;
                    for (var i = max; i < buffer.Count; i++)
                    {
                        keyDocumentMap.Remove(QueryParams.GetDocumentId(buffer[i]));
                    }
                    buffer.RemoveRange(max, buffer.Count - max);
                    Complete = false;
                }
            }
        }

        /// <summary>
        /// The slice rule:
        /// Exactly Offset matching rows sort before the first row of the buffer,
        /// and all matching rows that sort between the first and the last row are in the buffer.
        /// After the change event, this is still true for the old first and last row, so:
        /// - the old version of the changed row is removed from the buffer,
        /// - the new version is added if it sorts between the old first and last row,
        /// - Offset changes by one if the changed row moved into or out of the rows before the first row.
        /// If Offset is 0, there are no rows before the first row, so a row that sorts before it is added.
        /// If the buffer is complete, there are no rows after the last row, so a row that sorts after it is added.
        ///
        /// An empty buffer (only valid when complete) knows only the number of rows before it.
        /// There, Offset is only an upper bound, which stays an upper bound with the same update.
        /// </summary>
        private void ApplySliceRule(ChangeEvent<TDoc> changeEvent)
        {
            var wasMatching = changeEvent.HasPrevious && QueryParams.QueryMatcher(changeEvent.Previous);
            var doesMatchNow = changeEvent.HasDoc && QueryParams.QueryMatcher(changeEvent.Doc);

            if (buffer.Count == 0)
            {
                if (Offset == 0)
                {
                    // there are no rows at all
                    if (doesMatchNow)
                    {
                        InsertAtSortPosition(changeEvent.Doc);
                    }
                }
                else
                {
                    Offset += (doesMatchNow ? 1 : 0) - (wasMatching ? 1 : 0);
                }
                return;
            }

            var first = buffer[0];
            var last = buffer[buffer.Count - 1];
            var hasRowsBefore = Offset > 0;
            var wasBefore = wasMatching && hasRowsBefore && CompareRows(changeEvent.Previous, first) < 0;
            var isBeforeNow = doesMatchNow && hasRowsBefore && CompareRows(changeEvent.Doc, first) < 0;

            var id = changeEvent.Id;
            if (keyDocumentMap.Remove(id))
            {
                var getId = QueryParams.GetDocumentId;
                buffer.RemoveAt(buffer.FindIndex(d => getId(d) == id));
            }
            if (doesMatchNow && !isBeforeNow && (Complete || CompareRows(changeEvent.Doc, last) <= 0))
            {
                InsertAtSortPosition(changeEvent.Doc);
            }
            Offset += (isBeforeNow ? 1 : 0) - (wasBefore ? 1 : 0);
        }

        /// <summary>
        /// Compares two rows with the sort comparator of the query.
        /// Returns 0 only for two versions of the same row that sort at the same position.
        /// For different rows that the comparator sees as equal,
        /// the primary key decides, so that the order is always deterministic.
        /// </summary>
        private int CompareRows(TDoc a, TDoc b)
        {
            var idA = QueryParams.GetDocumentId(a);
            var idB = QueryParams.GetDocumentId(b);
            var result = Math.Sign(QueryParams.SortComparator(a, b));
            if (idA == idB)
            {
                // A deterministic comparator breaks ties by the primary key,
                // which gives the same answer for both directions when the sort values are equal.
                if (result == 0 || result == Math.Sign(QueryParams.SortComparator(b, a)))
                {
                    return 0;
                }
                return result;
            }
            if (result != 0)
            {
                return result;
            }
            return Math.Sign(string.CompareOrdinal(idA, idB));
        }

        private void InsertAtSortPosition(TDoc doc)
        {
            // binary search for the first row that sorts after doc
            var low = 0;
            var high = buffer.Count;
            while (low < high)
            {
                var mid = (low + high) >> 1;
                if (CompareRows(buffer[mid], doc) < 0)
                {
                    low = mid + 1;
                }
                else
                {
                    high = mid;
                }
            }
            buffer.Insert(low, doc);
            keyDocumentMap[QueryParams.GetDocumentId(doc)] = doc;
        }
    }
}
