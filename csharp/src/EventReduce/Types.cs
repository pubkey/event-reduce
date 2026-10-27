using System;
using System.Collections.Generic;

namespace EventReduce
{
    /// <summary>The kind of a write on the database.</summary>
    public enum WriteOperation
    {
        /// <summary>A document was inserted.</summary>
        Insert,
        /// <summary>A document was updated.</summary>
        Update,
        /// <summary>A document was deleted.</summary>
        Delete,
    }

    /// <summary>
    /// A write event on the database.
    /// <see cref="Id"/> is the value of the primary key of the changed document.
    /// Works with classes and structs as documents.
    /// </summary>
    public sealed class ChangeEvent<TDoc>
    {
        /// <summary>The kind of the write.</summary>
        public WriteOperation Operation { get; }

        /// <summary>The value of the primary key of the changed document.</summary>
        public string Id { get; }

        /// <summary>The document after the write, only set if <see cref="HasDoc"/>.</summary>
        public TDoc Doc { get; }

        /// <summary>The document before the write, only set if <see cref="HasPrevious"/>.</summary>
        public TDoc Previous { get; }

        /// <summary>False on deletes.</summary>
        public bool HasDoc => Operation != WriteOperation.Delete;

        /// <summary>False on inserts.</summary>
        public bool HasPrevious => Operation != WriteOperation.Insert;

        private ChangeEvent(WriteOperation operation, string id, TDoc doc, TDoc previous)
        {
            Operation = operation;
            Id = id;
            Doc = doc;
            Previous = previous;
        }

        /// <summary>Creates the event of an inserted document.</summary>
        public static ChangeEvent<TDoc> Insert(string id, TDoc doc) =>
            new ChangeEvent<TDoc>(WriteOperation.Insert, id, doc, default!);

        /// <summary>Creates the event of an updated document.</summary>
        public static ChangeEvent<TDoc> Update(string id, TDoc doc, TDoc previous) =>
            new ChangeEvent<TDoc>(WriteOperation.Update, id, doc, previous);

        /// <summary>Creates the event of a deleted document.</summary>
        public static ChangeEvent<TDoc> Delete(string id, TDoc previous) =>
            new ChangeEvent<TDoc>(WriteOperation.Delete, id, default!, previous);

        /// <inheritdoc/>
        public override string ToString() =>
            $"ChangeEvent({Operation}, {Id}, doc: {(HasDoc ? Doc?.ToString() : "-")}, previous: {(HasPrevious ? Previous?.ToString() : "-")})";
    }

    /// <summary>Describes the query whose results are kept up to date.</summary>
    public sealed class QueryParams<TDoc>
    {
        /// <summary>
        /// Returns the id of a document.
        /// Must return the same value as the id of the change events.
        /// </summary>
        public Func<TDoc, string> GetDocumentId { get; set; } = null!;

        /// <summary>The number of rows to skip, null for none.</summary>
        public int? Skip { get; set; }

        /// <summary>The maximum number of rows, null for no limit.</summary>
        public int? Limit { get; set; }

        /// <summary>Returns true if the document matches the query.</summary>
        public Func<TDoc, bool> QueryMatcher { get; set; } = null!;

        /// <summary>
        /// To have a deterministic sorting, the comparator must never return 0
        /// for two different documents. Use the primary key as last sort field to ensure that.
        /// </summary>
        public Comparison<TDoc> SortComparator { get; set; } = null!;

        /// <summary>
        /// Returns true if any of the fields that the query sorts by
        /// differs between the previous and the new version of a document.
        /// Called as <c>SortFieldsChanged(previous, doc)</c>.
        /// </summary>
        public Func<TDoc, TDoc, bool> SortFieldsChanged { get; set; } = null!;

        /// <summary>A copy with the given skip and limit.</summary>
        public QueryParams<TDoc> WithSkipAndLimit(int? skip, int? limit) => new QueryParams<TDoc>
        {
            GetDocumentId = GetDocumentId,
            Skip = skip,
            Limit = limit,
            QueryMatcher = QueryMatcher,
            SortComparator = SortComparator,
            SortFieldsChanged = SortFieldsChanged,
        };
    }

    /// <summary>
    /// The input of the state functions, of the action functions and of CalculateActionName().
    /// Action functions mutate <see cref="PreviousResults"/> and <see cref="KeyDocumentMap"/>.
    /// </summary>
    public sealed class StateResolveFunctionInput<TDoc>
    {
        /// <summary>The query.</summary>
        public QueryParams<TDoc> QueryParams { get; }

        /// <summary>The write event.</summary>
        public ChangeEvent<TDoc> ChangeEvent { get; }

        /// <summary>The results of the query before the write event.</summary>
        public List<TDoc> PreviousResults { get; }

        /// <summary>Map from the id of each document in the results to the document, optional.</summary>
        public Dictionary<string, TDoc>? KeyDocumentMap { get; }

        /// <summary>Creates the input.</summary>
        public StateResolveFunctionInput(
            QueryParams<TDoc> queryParams,
            ChangeEvent<TDoc> changeEvent,
            List<TDoc> previousResults,
            Dictionary<string, TDoc>? keyDocumentMap = null)
        {
            QueryParams = queryParams;
            ChangeEvent = changeEvent;
            PreviousResults = previousResults;
            KeyDocumentMap = keyDocumentMap;
        }
    }

    /// <summary>The actions, in the same order as the JavaScript implementation.</summary>
    public enum ActionName
    {
        /// <summary>doNothing</summary>
        DoNothing,
        /// <summary>insertFirst</summary>
        InsertFirst,
        /// <summary>insertLast</summary>
        InsertLast,
        /// <summary>removeFirstItem</summary>
        RemoveFirstItem,
        /// <summary>removeLastItem</summary>
        RemoveLastItem,
        /// <summary>removeFirstInsertLast</summary>
        RemoveFirstInsertLast,
        /// <summary>removeLastInsertFirst</summary>
        RemoveLastInsertFirst,
        /// <summary>removeFirstInsertFirst</summary>
        RemoveFirstInsertFirst,
        /// <summary>removeLastInsertLast</summary>
        RemoveLastInsertLast,
        /// <summary>removeExisting</summary>
        RemoveExisting,
        /// <summary>replaceExisting</summary>
        ReplaceExisting,
        /// <summary>Only used by the truth-table generator, never returned by the BDD.</summary>
        AlwaysWrong,
        /// <summary>insertAtSortPosition</summary>
        InsertAtSortPosition,
        /// <summary>removeExistingAndInsertAtSortPosition</summary>
        RemoveExistingAndInsertAtSortPosition,
        /// <summary>insertAtSortPositionRemoveLast</summary>
        InsertAtSortPositionRemoveLast,
        /// <summary>insertAtSortPositionRemoveFirst</summary>
        InsertAtSortPositionRemoveFirst,
        /// <summary>The query must be run over the database again.</summary>
        RunFullQueryAgain,
        /// <summary>If a state was never reached, we do not know the correct action.</summary>
        UnknownAction,
    }

    /// <summary>The states, in the same order as the JavaScript implementation.</summary>
    public enum StateName
    {
        /// <summary>isInsert</summary>
        IsInsert,
        /// <summary>isUpdate</summary>
        IsUpdate,
        /// <summary>isDelete</summary>
        IsDelete,
        /// <summary>hasLimit</summary>
        HasLimit,
        /// <summary>isFindOne</summary>
        IsFindOne,
        /// <summary>hasSkip</summary>
        HasSkip,
        /// <summary>wasResultsEmpty</summary>
        WasResultsEmpty,
        /// <summary>wasLimitReached</summary>
        WasLimitReached,
        /// <summary>wasFirst</summary>
        WasFirst,
        /// <summary>wasLast</summary>
        WasLast,
        /// <summary>sortParamsChanged</summary>
        SortParamsChanged,
        /// <summary>wasInResult</summary>
        WasInResult,
        /// <summary>wasSortedBeforeFirst</summary>
        WasSortedBeforeFirst,
        /// <summary>wasSortedAfterLast</summary>
        WasSortedAfterLast,
        /// <summary>isSortedBeforeFirst</summary>
        IsSortedBeforeFirst,
        /// <summary>isSortedAfterLast</summary>
        IsSortedAfterLast,
        /// <summary>wasMatching</summary>
        WasMatching,
        /// <summary>doesMatchNow</summary>
        DoesMatchNow,
    }

    /// <summary>Thrown for the actions that cannot be applied to the results and for invalid input.</summary>
    public sealed class EventReduceException : Exception
    {
        /// <summary>The code, like the one of the JavaScript implementation, e.g. RUN_FULL.</summary>
        public string Code { get; }

        /// <summary>Creates the exception.</summary>
        public EventReduceException(string code) : base("EventReduce:" + code)
        {
            Code = code;
        }
    }

    /// <summary>Helpers for the enums.</summary>
    public static class NameExtensions
    {
        /// <summary>The name as used by the JavaScript implementation.</summary>
        public static string ToJsName(this ActionName action) => LowerFirst(action.ToString());

        /// <summary>The name as used by the JavaScript implementation.</summary>
        public static string ToJsName(this StateName state) => LowerFirst(state.ToString());

        private static string LowerFirst(string name) => char.ToLowerInvariant(name[0]) + name.Substring(1);
    }
}
