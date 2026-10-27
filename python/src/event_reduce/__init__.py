"""
EventReduce: update live query results from change events without re-running the query.

Only the BDD that the JavaScript implementation generated is used, it is not created or optimized here.
"""

from __future__ import annotations

from typing import Any, TypeVar

from .actions import ACTION_FUNCTION_LIST, ACTION_FUNCTIONS, ORDERED_ACTION_LIST, ActionFunction
from .bdd import PACKED_BDD, packed_bdd_from_base64_string, resolve_input
from .bdd_generated import PACKED_BDD_STRING
from .result_window_buffer import (
    ResultWindowBuffer,
    ResultWindowBufferChangeResult,
    ResultWindowBufferQuery,
    ResultWindowBufferResult,
    get_recommended_result_window_buffer_size,
)
from .states import ORDERED_STATE_LIST, STATE_RESOLVE_FUNCTIONS, get_state_set, resolve_state
from .types import (
    ActionFunctionInput,
    ActionName,
    ChangeEvent,
    EventReduceError,
    QueryParams,
    ResultKeyDocumentMap,
    StateName,
    StateResolveFunctionInput,
    WriteOperation,
)
from .util import dict_query_params, get_property

D = TypeVar("D")


def calculate_action_name(input: StateResolveFunctionInput[Any]) -> ActionName:
    """
    Returns the action that transforms the previous results into the new results.
    If it is RUN_FULL_QUERY_AGAIN, the query must be run over the database again.
    """
    return ORDERED_ACTION_LIST[resolve_input(input)]


def calculate_action_function(input: StateResolveFunctionInput[Any]) -> ActionFunction:
    """Like calculate_action_name() but returns the action function directly."""
    return ACTION_FUNCTION_LIST[resolve_input(input)]


def run_action(
    action: ActionName,
    query_params: QueryParams[D],
    change_event: ChangeEvent[D],
    previous_results: list[D],
    key_document_map: dict[str, D] | None = None,
) -> list[D]:
    """
    Applies the action to the results.
    For performance reasons, it mutates previous_results and the key_document_map
    and returns the mutated results.
    Raises an EventReduceError for RUN_FULL_QUERY_AGAIN and UNKNOWN_ACTION.
    """
    ACTION_FUNCTIONS[action](StateResolveFunctionInput(query_params, change_event, previous_results, key_document_map))
    return previous_results


__all__ = [
    "ACTION_FUNCTIONS",
    "ACTION_FUNCTION_LIST",
    "ORDERED_ACTION_LIST",
    "ORDERED_STATE_LIST",
    "PACKED_BDD",
    "PACKED_BDD_STRING",
    "STATE_RESOLVE_FUNCTIONS",
    "ActionFunction",
    "ActionFunctionInput",
    "ActionName",
    "ChangeEvent",
    "EventReduceError",
    "QueryParams",
    "ResultKeyDocumentMap",
    "ResultWindowBuffer",
    "ResultWindowBufferChangeResult",
    "ResultWindowBufferQuery",
    "ResultWindowBufferResult",
    "StateName",
    "StateResolveFunctionInput",
    "WriteOperation",
    "calculate_action_function",
    "calculate_action_name",
    "dict_query_params",
    "get_property",
    "get_recommended_result_window_buffer_size",
    "get_state_set",
    "packed_bdd_from_base64_string",
    "resolve_input",
    "resolve_state",
    "run_action",
]
