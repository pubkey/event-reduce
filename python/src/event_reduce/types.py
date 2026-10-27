from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum
from typing import Generic, TypeVar

D = TypeVar("D")


class WriteOperation(str, Enum):
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


@dataclass(frozen=True)
class ChangeEvent(Generic[D]):
    """
    A write event on the database.
    `id` is the value of the primary key of the changed document.
    `doc` is the document after the write (None on deletes),
    `previous` the document before the write (None on inserts).
    """

    operation: WriteOperation
    id: str
    doc: D | None
    previous: D | None

    @staticmethod
    def insert(id: str, doc: D) -> ChangeEvent[D]:
        return ChangeEvent(WriteOperation.INSERT, id, doc, None)

    @staticmethod
    def update(id: str, doc: D, previous: D) -> ChangeEvent[D]:
        return ChangeEvent(WriteOperation.UPDATE, id, doc, previous)

    @staticmethod
    def delete(id: str, previous: D) -> ChangeEvent[D]:
        return ChangeEvent(WriteOperation.DELETE, id, None, previous)


@dataclass(frozen=True)
class QueryParams(Generic[D]):
    """
    Describes the query whose results are kept up to date.
    For dict documents, dict_query_params() creates it from a primary key and the sort fields.
    """

    get_document_id: Callable[[D], str]
    """Returns the id of a document, must return the same value as the id of the change events."""
    query_matcher: Callable[[D], bool]
    """Returns true if the document matches the query."""
    sort_comparator: Callable[[D, D], int]
    """
    To have a deterministic sorting, the comparator must never return 0
    for two different documents. Use the primary key as last sort field to ensure that.
    """
    sort_fields_changed: Callable[[D, D], bool]
    """
    Returns true if any of the fields that the query sorts by
    differs between the previous and the new version of a document.
    Called as sort_fields_changed(previous, doc).
    """
    skip: int | None = None
    limit: int | None = None


ResultKeyDocumentMap = dict[str, D]
"""Map from the id of each document in the results to the document."""


@dataclass
class StateResolveFunctionInput(Generic[D]):
    """
    The input of the state functions, of the action functions and of calculate_action_name().
    Action functions mutate previous_results and key_document_map.
    """

    query_params: QueryParams[D]
    change_event: ChangeEvent[D]
    previous_results: list[D]
    key_document_map: dict[str, D] | None = None


class ActionName(str, Enum):
    """The actions, in the same order as the JavaScript implementation, the values are the JavaScript names."""

    DO_NOTHING = "doNothing"
    INSERT_FIRST = "insertFirst"
    INSERT_LAST = "insertLast"
    REMOVE_FIRST_ITEM = "removeFirstItem"
    REMOVE_LAST_ITEM = "removeLastItem"
    REMOVE_FIRST_INSERT_LAST = "removeFirstInsertLast"
    REMOVE_LAST_INSERT_FIRST = "removeLastInsertFirst"
    REMOVE_FIRST_INSERT_FIRST = "removeFirstInsertFirst"
    REMOVE_LAST_INSERT_LAST = "removeLastInsertLast"
    REMOVE_EXISTING = "removeExisting"
    REPLACE_EXISTING = "replaceExisting"
    # only used by the truth-table generator, never returned by the BDD
    ALWAYS_WRONG = "alwaysWrong"
    INSERT_AT_SORT_POSITION = "insertAtSortPosition"
    REMOVE_EXISTING_AND_INSERT_AT_SORT_POSITION = "removeExistingAndInsertAtSortPosition"
    INSERT_AT_SORT_POSITION_REMOVE_LAST = "insertAtSortPositionRemoveLast"
    INSERT_AT_SORT_POSITION_REMOVE_FIRST = "insertAtSortPositionRemoveFirst"
    RUN_FULL_QUERY_AGAIN = "runFullQueryAgain"
    # if a state was never reached, we do not know the correct action
    UNKNOWN_ACTION = "unknownAction"


class StateName(str, Enum):
    """The states, in the same order as the JavaScript implementation, the values are the JavaScript names."""

    IS_INSERT = "isInsert"
    IS_UPDATE = "isUpdate"
    IS_DELETE = "isDelete"
    HAS_LIMIT = "hasLimit"
    IS_FIND_ONE = "isFindOne"
    HAS_SKIP = "hasSkip"
    WAS_RESULTS_EMPTY = "wasResultsEmpty"
    WAS_LIMIT_REACHED = "wasLimitReached"
    WAS_FIRST = "wasFirst"
    WAS_LAST = "wasLast"
    SORT_PARAMS_CHANGED = "sortParamsChanged"
    WAS_IN_RESULT = "wasInResult"
    WAS_SORTED_BEFORE_FIRST = "wasSortedBeforeFirst"
    WAS_SORTED_AFTER_LAST = "wasSortedAfterLast"
    IS_SORTED_BEFORE_FIRST = "isSortedBeforeFirst"
    IS_SORTED_AFTER_LAST = "isSortedAfterLast"
    WAS_MATCHING = "wasMatching"
    DOES_MATCH_NOW = "doesMatchNow"


class EventReduceError(Exception):
    """Raised for the actions that cannot be applied to the results and for invalid input."""

    def __init__(self, code: str) -> None:
        super().__init__("EventReduce:" + code)
        self.code = code
