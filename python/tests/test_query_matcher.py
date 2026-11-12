"""The query matcher can return any truthy or falsy value, like in the JavaScript implementation."""

from __future__ import annotations

from typing import Any

from event_reduce import ChangeEvent, QueryParams, ResultWindowBuffer, dict_query_params

Doc = dict[str, Any]


def query_params(query_matcher: Any) -> QueryParams[Doc]:
    def sort_comparator(a: Doc, b: Doc) -> int:
        if a["age"] != b["age"]:
            return -1 if a["age"] < b["age"] else 1
        return -1 if a["id"] < b["id"] else 1

    return dict_query_params(
        primary_key="id",
        sort_fields=["age", "id"],
        query_matcher=query_matcher,
        sort_comparator=sort_comparator,
        skip=2,
        limit=2,
    )


def empty_buffer(query_matcher: Any) -> ResultWindowBuffer[Doc]:
    """A buffer of a query that found no rows after the skip, so it only knows the offset."""
    buffer = ResultWindowBuffer(query_params(query_matcher), 1, 1)
    buffer.reset([])
    assert buffer.offset == 1
    return buffer


def test_matcher_that_returns_none() -> None:
    buffer = empty_buffer(lambda doc: True if doc["age"] > 0 else None)
    # did not match before, matches now: one more row before the buffer
    event = ChangeEvent.update("b", {"id": "b", "age": 2}, {"id": "b", "age": 0})
    assert buffer.apply_change_event(event) == "buffer"
    assert buffer.offset == 2


def test_matcher_that_returns_a_number() -> None:
    buffer = empty_buffer(lambda doc: doc["age"])
    # a truthy value counts as one matching row, whatever the value is
    assert buffer.apply_change_event(ChangeEvent.insert("g", {"id": "g", "age": 5})) == "buffer"
    assert buffer.offset == 2
    assert buffer.results() == []
