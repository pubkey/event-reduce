from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .types import ActionName, EventReduceError, StateResolveFunctionInput
from .util import index_of_document_id, push_at_sort_position

ActionFunction = Callable[[StateResolveFunctionInput[Any]], None]
"""For performance reasons, action functions mutate the results and the key document map of the input."""

ORDERED_ACTION_LIST: list[ActionName] = list(ActionName)
"""All actions, in the same order as the JavaScript implementation. The BDD references the actions by their index."""


def _find_index_of_changed_doc(input: StateResolveFunctionInput[Any]) -> int:
    """Returns the index of the changed document inside of the previous results or -1."""
    id = input.change_event.id
    if input.key_document_map is not None and id not in input.key_document_map:
        return -1
    return index_of_document_id(input.query_params, input.previous_results, id)


def _changed_doc(input: StateResolveFunctionInput[Any]) -> Any:
    """The new document of the change event. Only the BDD knows that it exists for the given action."""
    doc = input.change_event.doc
    if doc is None:
        raise EventReduceError("UNK_ACT")
    return doc


def _add_to_map(input: StateResolveFunctionInput[Any], doc: Any) -> None:
    if input.key_document_map is not None:
        input.key_document_map[input.change_event.id] = doc


def _remove_from_map(input: StateResolveFunctionInput[Any], id: str) -> None:
    if input.key_document_map is not None:
        input.key_document_map.pop(id, None)


def do_nothing(input: StateResolveFunctionInput[Any]) -> None:
    pass


def insert_first(input: StateResolveFunctionInput[Any]) -> None:
    doc = _changed_doc(input)
    input.previous_results.insert(0, doc)
    _add_to_map(input, doc)


def insert_last(input: StateResolveFunctionInput[Any]) -> None:
    doc = _changed_doc(input)
    input.previous_results.append(doc)
    _add_to_map(input, doc)


def remove_first_item(input: StateResolveFunctionInput[Any]) -> None:
    if not input.previous_results:
        return
    first = input.previous_results.pop(0)
    _remove_from_map(input, input.query_params.get_document_id(first))


def remove_last_item(input: StateResolveFunctionInput[Any]) -> None:
    if not input.previous_results:
        return
    last = input.previous_results.pop()
    _remove_from_map(input, input.query_params.get_document_id(last))


def remove_first_insert_last(input: StateResolveFunctionInput[Any]) -> None:
    remove_first_item(input)
    insert_last(input)


def remove_last_insert_first(input: StateResolveFunctionInput[Any]) -> None:
    remove_last_item(input)
    insert_first(input)


def remove_first_insert_first(input: StateResolveFunctionInput[Any]) -> None:
    remove_first_item(input)
    insert_first(input)


def remove_last_insert_last(input: StateResolveFunctionInput[Any]) -> None:
    remove_last_item(input)
    insert_last(input)


def remove_existing(input: StateResolveFunctionInput[Any]) -> None:
    index = _find_index_of_changed_doc(input)
    _remove_from_map(input, input.change_event.id)
    if index >= 0:
        del input.previous_results[index]


def replace_existing(input: StateResolveFunctionInput[Any]) -> None:
    index = _find_index_of_changed_doc(input)
    if index >= 0:
        doc = _changed_doc(input)
        input.previous_results[index] = doc
        _add_to_map(input, doc)


def insert_at_sort_position(input: StateResolveFunctionInput[Any]) -> None:
    doc = _changed_doc(input)
    id = input.change_event.id
    key_document_map = input.key_document_map
    # If document is already in results,
    # we cannot add it again because it would throw on non-deterministic ordering.
    if key_document_map is not None:
        if id in key_document_map:
            return
        key_document_map[id] = doc
    elif index_of_document_id(input.query_params, input.previous_results, id) >= 0:
        return
    push_at_sort_position(input.previous_results, doc, input.query_params.sort_comparator)


def remove_existing_and_insert_at_sort_position(input: StateResolveFunctionInput[Any]) -> None:
    remove_existing(input)
    insert_at_sort_position(input)


def _insert_at_sort_position_and_remove(input: StateResolveFunctionInput[Any], remove: ActionFunction) -> None:
    length_before = len(input.previous_results)
    insert_at_sort_position(input)
    # insert_at_sort_position() does nothing if the document is already in the results
    if len(input.previous_results) > length_before:
        remove(input)


def insert_at_sort_position_remove_last(input: StateResolveFunctionInput[Any]) -> None:
    """
    Inserts the document at its sort position and then removes the last document.
    Used when the limit was reached and the new document
    sorts in between the first and the last document,
    so the previous last document is pushed out of the results.
    """
    _insert_at_sort_position_and_remove(input, remove_last_item)


def insert_at_sort_position_remove_first(input: StateResolveFunctionInput[Any]) -> None:
    """
    Inserts the document at its sort position and then removes the first document.
    Used when a document moves out of the skipped documents into the results,
    so the previous first document is pushed into the skipped documents.
    """
    _insert_at_sort_position_and_remove(input, remove_first_item)


def run_full_query_again(input: StateResolveFunctionInput[Any]) -> None:
    raise EventReduceError("RUN_FULL")


def unknown_action(input: StateResolveFunctionInput[Any]) -> None:
    raise EventReduceError("UNK_ACT")


ACTION_FUNCTION_LIST: list[ActionFunction] = [
    do_nothing,
    insert_first,
    insert_last,
    remove_first_item,
    remove_last_item,
    remove_first_insert_last,
    remove_last_insert_first,
    remove_first_insert_first,
    remove_last_insert_last,
    remove_existing,
    replace_existing,
    # alwaysWrong is only used by the truth-table generator and never returned by the BDD
    unknown_action,
    insert_at_sort_position,
    remove_existing_and_insert_at_sort_position,
    insert_at_sort_position_remove_last,
    insert_at_sort_position_remove_first,
    run_full_query_again,
    unknown_action,
]
"""The action functions in the same order as ORDERED_ACTION_LIST."""
