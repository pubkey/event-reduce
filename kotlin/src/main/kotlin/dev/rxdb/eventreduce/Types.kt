package dev.rxdb.eventreduce

/**
 * A write event on the database.
 * [id] is the value of the primary key of the changed document.
 */
public sealed class ChangeEvent<out D> {
    public abstract val id: String

    /** The document after the write, null on deletes. */
    public abstract val doc: D?

    /** The document before the write, null on inserts. */
    public abstract val previous: D?

    public data class Insert<D>(override val id: String, override val doc: D) : ChangeEvent<D>() {
        override val previous: D? get() = null
    }

    public data class Update<D>(
        override val id: String,
        override val doc: D,
        override val previous: D,
    ) : ChangeEvent<D>()

    public data class Delete<D>(override val id: String, override val previous: D) : ChangeEvent<D>() {
        override val doc: D? get() = null
    }
}

/**
 * Describes the query whose results are kept up to date.
 */
public data class QueryParams<D>(
    /**
     * Returns the id of a document.
     * Must return the same value as the id of the change events.
     */
    public val getDocumentId: (D) -> String,
    public val skip: Int? = null,
    public val limit: Int? = null,
    /** Returns true if the document matches the query. */
    public val queryMatcher: (D) -> Boolean,
    /**
     * To have a deterministic sorting, the comparator must never return 0
     * for two different documents. Use the primary key as last sort field to ensure that.
     */
    public val sortComparator: Comparator<D>,
    /**
     * Returns true if any of the fields that the query sorts by
     * differs between the previous and the new version of a document.
     * Called as `sortFieldsChanged(previous, doc)`.
     */
    public val sortFieldsChanged: (previous: D, doc: D) -> Boolean,
)

/** The input of the state functions and of calculateActionName(). */
public open class StateResolveFunctionInput<D>(
    public val queryParams: QueryParams<D>,
    public val changeEvent: ChangeEvent<D>,
    public open val previousResults: List<D>,
    /** Map from the id of each document in the results to the document. */
    public open val keyDocumentMap: Map<String, D>? = null,
)

/**
 * The input of the action functions, which mutate the results and the map in place.
 * It is also a [StateResolveFunctionInput], so the same input can calculate and run the action.
 */
public class ActionFunctionInput<D>(
    queryParams: QueryParams<D>,
    changeEvent: ChangeEvent<D>,
    override val previousResults: MutableList<D>,
    override val keyDocumentMap: MutableMap<String, D>? = null,
) : StateResolveFunctionInput<D>(queryParams, changeEvent, previousResults, keyDocumentMap)

public enum class ActionName {
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

    /** Only used by the truth-table generator, never returned by the BDD. */
    AlwaysWrong,
    InsertAtSortPosition,
    RemoveExistingAndInsertAtSortPosition,
    InsertAtSortPositionRemoveLast,
    InsertAtSortPositionRemoveFirst,
    RunFullQueryAgain,

    /** If a state was never reached, we do not know the correct action. */
    UnknownAction,
    ;

    /** The name as used by the JavaScript implementation. */
    public val jsName: String get() = name.replaceFirstChar { it.lowercaseChar() }
}

public enum class StateName {
    IsInsert,
    IsUpdate,
    IsDelete,
    HasLimit,
    IsFindOne,
    HasSkip,
    WasResultsEmpty,
    WasLimitReached,
    WasFirst,
    WasLast,
    SortParamsChanged,
    WasInResult,
    WasSortedBeforeFirst,
    WasSortedAfterLast,
    IsSortedBeforeFirst,
    IsSortedAfterLast,
    WasMatching,
    DoesMatchNow,
    ;

    /** The name as used by the JavaScript implementation. */
    public val jsName: String get() = name.replaceFirstChar { it.lowercaseChar() }
}

/** Thrown by runAction() for the actions that cannot be applied to the results. */
public class EventReduceException(public val code: String) : RuntimeException("EventReduce:$code")
