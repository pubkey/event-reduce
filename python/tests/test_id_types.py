"""Ids are compared without conversion: a string id never equals a number id."""

from __future__ import annotations

from typing import Any

from event_reduce import (
    ActionName,
    ChangeEvent,
    StateResolveFunctionInput,
    calculate_action_name,
    dict_query_params,
    get_state_set,
    run_action,
)

Doc = dict[str, Any]
QUERY_PARAMS = dict_query_params(
    primary_key="id",
    sort_fields=["age"],
    query_matcher=lambda doc: True,
    sort_comparator=lambda a, b: -1 if (a["age"], str(a["id"])) < (b["age"], str(b["id"])) else 1,
)
WAS_IN_RESULT = 11
"""Index of the state wasInResult in a state set."""


def apply(results: list[Doc], event: ChangeEvent[Doc], with_map: bool) -> list[Doc]:
    key_document_map = {doc["id"]: doc for doc in results} if with_map else None
    input = StateResolveFunctionInput(QUERY_PARAMS, event, results, key_document_map)
    return run_action(calculate_action_name(input), QUERY_PARAMS, event, results, key_document_map)


def test_the_document_id_is_not_converted() -> None:
    assert QUERY_PARAMS.get_document_id({"id": 1, "age": 1}) == 1
    assert QUERY_PARAMS.get_document_id({"id": "1", "age": 1}) == "1"


def test_number_ids_work() -> None:
    # before, the id of the document was converted to "1" and did not match the id 1 of the event,
    # so the update added the document a second time
    for with_map in (False, True):
        previous: Doc = {"id": 1, "age": 1}
        other: Doc = {"id": 2, "age": 5}
        changed: Doc = {"id": 1, "age": 9}
        event: ChangeEvent[Doc] = ChangeEvent.update(1, changed, previous)  # type: ignore[arg-type]
        assert apply([previous, other], event, with_map) == [other, changed]


def test_a_string_id_never_equals_a_number_id() -> None:
    for with_map in (False, True):
        number_doc: Doc = {"id": 1, "age": 1}
        string_doc: Doc = {"id": "1", "age": 2}

        # the document "1" is not in the results, although the document 1 is
        event = ChangeEvent.insert("1", string_doc)
        key_document_map = {1: number_doc} if with_map else None
        input = StateResolveFunctionInput(QUERY_PARAMS, event, [number_doc], key_document_map)  # type: ignore[arg-type]
        assert get_state_set(input)[WAS_IN_RESULT] == "0"
        assert calculate_action_name(input) == ActionName.INSERT_LAST

        # so the insert adds a second document and does not replace the first
        assert apply([number_doc], event, with_map) == [number_doc, string_doc]
