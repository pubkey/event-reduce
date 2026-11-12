"""
When the key document map is out of sync and does not have a document that is in the results,
the actions must still find the document in the results, like the JavaScript implementation.
"""

from __future__ import annotations

from typing import Any

from event_reduce import ActionName, ChangeEvent, dict_query_params, run_action

Doc = dict[str, Any]

QUERY_PARAMS = dict_query_params(
    primary_key="id",
    sort_fields=["age", "id"],
    query_matcher=lambda doc: True,
    sort_comparator=lambda a, b: -1 if (a["age"], a["id"]) < (b["age"], b["id"]) else 1,
)
A: Doc = {"id": "a", "age": 1}
B: Doc = {"id": "b", "age": 2}


def run(action: ActionName, event: ChangeEvent[Doc]) -> tuple[list[Doc], dict[str, Doc]]:
    key_document_map = {"b": B}
    results = run_action(action, QUERY_PARAMS, event, [A, B], key_document_map)
    return results, key_document_map


def test_remove_existing() -> None:
    results, key_document_map = run(ActionName.REMOVE_EXISTING, ChangeEvent.delete("a", A))
    assert results == [B]
    assert key_document_map == {"b": B}


def test_replace_existing() -> None:
    changed = {"id": "a", "age": 1, "name": "changed"}
    results, key_document_map = run(ActionName.REPLACE_EXISTING, ChangeEvent.update("a", changed, A))
    assert results == [changed, B]
    assert key_document_map == {"a": changed, "b": B}


def test_remove_existing_and_insert_at_sort_position() -> None:
    moved = {"id": "a", "age": 5}
    results, key_document_map = run(
        ActionName.REMOVE_EXISTING_AND_INSERT_AT_SORT_POSITION, ChangeEvent.update("a", moved, A)
    )
    # no duplicate of the document
    assert results == [B, moved]
    assert key_document_map == {"a": moved, "b": B}
