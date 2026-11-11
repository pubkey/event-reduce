"""The sort fields of dict_query_params() are compared like in the JavaScript implementation."""

from __future__ import annotations

from typing import Any

from event_reduce import ChangeEvent, StateResolveFunctionInput, calculate_action_name, dict_query_params, run_action

Doc = dict[str, Any]


def sort_key(doc: Doc) -> tuple[int, Any, str]:
    """Sorts numbers before booleans before missing values, then by id."""
    value = doc.get("v")
    if value is None:
        return (2, 0, doc["id"])
    if isinstance(value, bool):
        return (1, value, doc["id"])
    return (0, value, doc["id"])


QUERY_PARAMS = dict_query_params(
    primary_key="id",
    sort_fields=["v", "id"],
    query_matcher=lambda doc: True,
    sort_comparator=lambda a, b: -1 if sort_key(a) < sort_key(b) else 1,
)


def apply(results: list[Doc], event: ChangeEvent[Doc]) -> list[Doc]:
    action = calculate_action_name(StateResolveFunctionInput(QUERY_PARAMS, event, results))
    run_action(action, QUERY_PARAMS, event, results)
    return results


def changed(previous: Doc, doc: Doc) -> bool:
    return QUERY_PARAMS.sort_fields_changed(previous, doc)


def test_a_number_and_a_boolean_are_different_values() -> None:
    # in Python, 1 == True and 0 == False
    assert changed({"id": "a", "v": 1}, {"id": "a", "v": True})
    assert changed({"id": "a", "v": False}, {"id": "a", "v": 0})
    results = [{"id": "a", "v": 1}, {"id": "b", "v": 2}]
    apply(results, ChangeEvent.update("a", {"id": "a", "v": True}, {"id": "a", "v": 1}))
    assert [doc["id"] for doc in results] == ["b", "a"]


def test_none_and_a_missing_field_are_different_values() -> None:
    assert changed({"id": "a", "v": None}, {"id": "a"})
    assert changed({"id": "a"}, {"id": "a", "v": None})


def test_equal_values_are_not_changed() -> None:
    assert not changed({"id": "a", "v": 1}, {"id": "a", "v": 1})
    assert not changed({"id": "a", "v": 1}, {"id": "a", "v": 1.0})
    assert not changed({"id": "a", "v": True}, {"id": "a", "v": True})
    assert not changed({"id": "a", "v": None}, {"id": "a", "v": None})
    assert not changed({"id": "a"}, {"id": "a"})
    assert not changed({"id": "a", "v": [1, 2]}, {"id": "a", "v": [1, 2]})
    assert changed({"id": "a", "v": 1}, {"id": "a", "v": 2})
