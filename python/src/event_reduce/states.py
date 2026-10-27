from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .types import StateName, StateResolveFunctionInput, WriteOperation
from .util import index_of_document_id

StateResolveFunction = Callable[[StateResolveFunctionInput[Any]], bool]

ORDERED_STATE_LIST: list[StateName] = list(StateName)
"""All states, in the same order as the JavaScript implementation. The BDD references the states by their index."""


def has_limit(input: StateResolveFunctionInput[Any]) -> bool:
    return bool(input.query_params.limit)


def is_find_one(input: StateResolveFunctionInput[Any]) -> bool:
    return input.query_params.limit == 1


def has_skip(input: StateResolveFunctionInput[Any]) -> bool:
    skip = input.query_params.skip
    return skip is not None and skip > 0


def is_delete(input: StateResolveFunctionInput[Any]) -> bool:
    return input.change_event.operation == WriteOperation.DELETE


def is_insert(input: StateResolveFunctionInput[Any]) -> bool:
    return input.change_event.operation == WriteOperation.INSERT


def is_update(input: StateResolveFunctionInput[Any]) -> bool:
    return input.change_event.operation == WriteOperation.UPDATE


def was_limit_reached(input: StateResolveFunctionInput[Any]) -> bool:
    limit = input.query_params.limit
    return bool(limit) and len(input.previous_results) >= limit  # type: ignore[operator]


def sort_params_changed(input: StateResolveFunctionInput[Any]) -> bool:
    doc = input.change_event.doc
    prev = input.change_event.previous
    if doc is None:
        return False
    if prev is None:
        return True
    return input.query_params.sort_fields_changed(prev, doc)


def was_in_result(input: StateResolveFunctionInput[Any]) -> bool:
    id = input.change_event.id
    if input.key_document_map is not None:
        return id in input.key_document_map
    return index_of_document_id(input.query_params, input.previous_results, id) >= 0


def was_first(input: StateResolveFunctionInput[Any]) -> bool:
    results = input.previous_results
    return bool(results) and input.query_params.get_document_id(results[0]) == input.change_event.id


def was_last(input: StateResolveFunctionInput[Any]) -> bool:
    results = input.previous_results
    return bool(results) and input.query_params.get_document_id(results[-1]) == input.change_event.id


def _compare_previous_with_result(
    input: StateResolveFunctionInput[Any], first: bool, expected: Callable[[int], bool]
) -> bool:
    """
    Compares the previous document with the first or last result item.
    If the changed document is the result item itself,
    we cannot sort-compare them, because it might end in a non-deterministic
    sort order. Because both document could be equal.
    So instead we have to return true.
    """
    prev = input.change_event.previous
    results = input.previous_results
    if prev is None or not results:
        return False
    result_item = results[0] if first else results[-1]
    if input.query_params.get_document_id(result_item) == input.change_event.id:
        return True
    return expected(input.query_params.sort_comparator(prev, result_item))


def _compare_doc_with_result(
    input: StateResolveFunctionInput[Any], first: bool, expected: Callable[[int], bool]
) -> bool:
    """
    Compares the new document with the first or last result item.
    If the changed document is the result item itself,
    it compares with the neighbor of the result item instead,
    so we know if the changed document still sorts first or last.
    If there is no neighbor, the changed document is still first or last.
    """
    doc = input.change_event.doc
    results = input.previous_results
    if doc is None or not results:
        return False
    result_item = results[0] if first else results[-1]
    if input.query_params.get_document_id(result_item) == input.change_event.id:
        if len(results) < 2:
            return True
        result_item = results[1] if first else results[-2]
    return expected(input.query_params.sort_comparator(doc, result_item))


def was_sorted_before_first(input: StateResolveFunctionInput[Any]) -> bool:
    return _compare_previous_with_result(input, True, lambda c: c < 0)


def was_sorted_after_last(input: StateResolveFunctionInput[Any]) -> bool:
    return _compare_previous_with_result(input, False, lambda c: c > 0)


def is_sorted_before_first(input: StateResolveFunctionInput[Any]) -> bool:
    return _compare_doc_with_result(input, True, lambda c: c < 0)


def is_sorted_after_last(input: StateResolveFunctionInput[Any]) -> bool:
    return _compare_doc_with_result(input, False, lambda c: c > 0)


def was_matching(input: StateResolveFunctionInput[Any]) -> bool:
    prev = input.change_event.previous
    return prev is not None and input.query_params.query_matcher(prev)


def does_match_now(input: StateResolveFunctionInput[Any]) -> bool:
    doc = input.change_event.doc
    return doc is not None and input.query_params.query_matcher(doc)


def was_results_empty(input: StateResolveFunctionInput[Any]) -> bool:
    return not input.previous_results


STATE_RESOLVE_FUNCTION_BY_INDEX: list[StateResolveFunction] = [
    is_insert,
    is_update,
    is_delete,
    has_limit,
    is_find_one,
    has_skip,
    was_results_empty,
    was_limit_reached,
    was_first,
    was_last,
    sort_params_changed,
    was_in_result,
    was_sorted_before_first,
    was_sorted_after_last,
    is_sorted_before_first,
    is_sorted_after_last,
    was_matching,
    does_match_now,
]
"""The state functions in the same order as ORDERED_STATE_LIST."""

STATE_RESOLVE_FUNCTIONS: dict[StateName, StateResolveFunction] = dict(
    zip(ORDERED_STATE_LIST, STATE_RESOLVE_FUNCTION_BY_INDEX, strict=False)
)


def resolve_state(state: StateName, input: StateResolveFunctionInput[Any]) -> bool:
    return STATE_RESOLVE_FUNCTIONS[state](input)


def get_state_set(input: StateResolveFunctionInput[Any]) -> str:
    """
    Returns the binary representation of all states
    like '010110110111...' where the first '0' means that the first state is false.
    """
    return "".join("1" if fn(input) else "0" for fn in STATE_RESOLVE_FUNCTION_BY_INDEX)
