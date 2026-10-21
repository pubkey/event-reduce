use std::cmp::Ordering;
use std::collections::HashMap;
use std::fmt;

/// Map from the id of each document in the results to the document.
/// Pass it to speed up the lookups of documents in the results.
pub type ResultKeyDocumentMap<D, K> = HashMap<K, D>;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum WriteOperation {
    Insert,
    Update,
    Delete,
}

/// A write event on the database.
/// `id` is the value of the primary key of the changed document.
#[derive(Clone, Debug, PartialEq)]
pub enum ChangeEvent<D, K> {
    Insert { id: K, doc: D },
    Update { id: K, doc: D, previous: D },
    Delete { id: K, previous: D },
}

impl<D, K> ChangeEvent<D, K> {
    pub fn operation(&self) -> WriteOperation {
        match self {
            ChangeEvent::Insert { .. } => WriteOperation::Insert,
            ChangeEvent::Update { .. } => WriteOperation::Update,
            ChangeEvent::Delete { .. } => WriteOperation::Delete,
        }
    }

    pub fn id(&self) -> &K {
        match self {
            ChangeEvent::Insert { id, .. }
            | ChangeEvent::Update { id, .. }
            | ChangeEvent::Delete { id, .. } => id,
        }
    }

    /// The document after the write, `None` on deletes.
    pub fn doc(&self) -> Option<&D> {
        match self {
            ChangeEvent::Insert { doc, .. } | ChangeEvent::Update { doc, .. } => Some(doc),
            ChangeEvent::Delete { .. } => None,
        }
    }

    /// The document before the write, `None` on inserts.
    pub fn previous(&self) -> Option<&D> {
        match self {
            ChangeEvent::Update { previous, .. } | ChangeEvent::Delete { previous, .. } => {
                Some(previous)
            }
            ChangeEvent::Insert { .. } => None,
        }
    }
}

pub type QueryMatcher<D> = Box<dyn Fn(&D) -> bool>;

/// To have a deterministic sorting, the comparator must never return
/// `Ordering::Equal` for two different documents.
pub type DeterministicSortComparator<D> = Box<dyn Fn(&D, &D) -> Ordering>;

pub type SortFieldsChanged<D> = Box<dyn Fn(&D, &D) -> bool>;

/// Describes the query whose results are kept up to date.
pub struct QueryParams<D, K> {
    /// Returns the id of a document.
    /// Must return the same value as the id of the change events.
    pub get_document_id: for<'a> fn(&'a D) -> &'a K,
    pub skip: Option<usize>,
    pub limit: Option<usize>,
    /// Returns true if the document matches the query.
    pub query_matcher: QueryMatcher<D>,
    /// To have a deterministic sorting, the comparator must never return
    /// `Ordering::Equal` for two different documents.
    /// Use the primary key as last sort field to ensure that.
    pub sort_comparator: DeterministicSortComparator<D>,
    /// Returns true if any of the fields that the query sorts by
    /// differs between the previous and the new version of a document.
    /// Called as `sort_fields_changed(previous, doc)`.
    pub sort_fields_changed: SortFieldsChanged<D>,
}

impl<D, K> fmt::Debug for QueryParams<D, K> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("QueryParams")
            .field("skip", &self.skip)
            .field("limit", &self.limit)
            .finish_non_exhaustive()
    }
}

impl<D, K> QueryParams<D, K> {
    pub fn document_id<'a>(&self, doc: &'a D) -> &'a K {
        (self.get_document_id)(doc)
    }
}

/// The input of the state functions and of calculate_action_name().
pub struct StateResolveFunctionInput<'a, D, K> {
    pub query_params: &'a QueryParams<D, K>,
    pub change_event: &'a ChangeEvent<D, K>,
    pub previous_results: &'a [D],
    pub key_document_map: Option<&'a ResultKeyDocumentMap<D, K>>,
}

/// The input of the action functions.
/// Action functions mutate the results and the key document map in place.
pub struct ActionFunctionInput<'a, D, K> {
    pub query_params: &'a QueryParams<D, K>,
    pub change_event: &'a ChangeEvent<D, K>,
    pub previous_results: &'a mut Vec<D>,
    pub key_document_map: Option<&'a mut ResultKeyDocumentMap<D, K>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ActionName {
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
    /// Only used by the truth-table generator, never returned by the BDD.
    AlwaysWrong,
    InsertAtSortPosition,
    RemoveExistingAndInsertAtSortPosition,
    InsertAtSortPositionRemoveLast,
    InsertAtSortPositionRemoveFirst,
    RunFullQueryAgain,
    /// If a state was never reached, we do not know the correct action.
    UnknownAction,
}

impl ActionName {
    /// The name as used by the JavaScript implementation.
    pub fn as_str(&self) -> &'static str {
        match self {
            ActionName::DoNothing => "doNothing",
            ActionName::InsertFirst => "insertFirst",
            ActionName::InsertLast => "insertLast",
            ActionName::RemoveFirstItem => "removeFirstItem",
            ActionName::RemoveLastItem => "removeLastItem",
            ActionName::RemoveFirstInsertLast => "removeFirstInsertLast",
            ActionName::RemoveLastInsertFirst => "removeLastInsertFirst",
            ActionName::RemoveFirstInsertFirst => "removeFirstInsertFirst",
            ActionName::RemoveLastInsertLast => "removeLastInsertLast",
            ActionName::RemoveExisting => "removeExisting",
            ActionName::ReplaceExisting => "replaceExisting",
            ActionName::AlwaysWrong => "alwaysWrong",
            ActionName::InsertAtSortPosition => "insertAtSortPosition",
            ActionName::RemoveExistingAndInsertAtSortPosition => {
                "removeExistingAndInsertAtSortPosition"
            }
            ActionName::InsertAtSortPositionRemoveLast => "insertAtSortPositionRemoveLast",
            ActionName::InsertAtSortPositionRemoveFirst => "insertAtSortPositionRemoveFirst",
            ActionName::RunFullQueryAgain => "runFullQueryAgain",
            ActionName::UnknownAction => "unknownAction",
        }
    }
}

impl fmt::Display for ActionName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum StateName {
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
}

impl StateName {
    /// The name as used by the JavaScript implementation.
    pub fn as_str(&self) -> &'static str {
        match self {
            StateName::IsInsert => "isInsert",
            StateName::IsUpdate => "isUpdate",
            StateName::IsDelete => "isDelete",
            StateName::HasLimit => "hasLimit",
            StateName::IsFindOne => "isFindOne",
            StateName::HasSkip => "hasSkip",
            StateName::WasResultsEmpty => "wasResultsEmpty",
            StateName::WasLimitReached => "wasLimitReached",
            StateName::WasFirst => "wasFirst",
            StateName::WasLast => "wasLast",
            StateName::SortParamsChanged => "sortParamsChanged",
            StateName::WasInResult => "wasInResult",
            StateName::WasSortedBeforeFirst => "wasSortedBeforeFirst",
            StateName::WasSortedAfterLast => "wasSortedAfterLast",
            StateName::IsSortedBeforeFirst => "isSortedBeforeFirst",
            StateName::IsSortedAfterLast => "isSortedAfterLast",
            StateName::WasMatching => "wasMatching",
            StateName::DoesMatchNow => "doesMatchNow",
        }
    }
}

impl fmt::Display for StateName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Returned by run_action() for the actions that cannot be applied to the results.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventReduceError {
    /// The query must be run over the database again.
    RunFullQueryAgain,
    /// The action is not known to give correct results.
    UnknownAction,
}

impl fmt::Display for EventReduceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EventReduceError::RunFullQueryAgain => f.write_str("EventReduce:RUN_FULL"),
            EventReduceError::UnknownAction => f.write_str("EventReduce:UNK_ACT"),
        }
    }
}

impl std::error::Error for EventReduceError {}
