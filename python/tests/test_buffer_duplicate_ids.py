"""
Rows with the same id twice are a mistake of the caller.
Like the JavaScript implementation, the buffer must not fail with an internal error for them.
"""

from __future__ import annotations

from typing import Any

from event_reduce import ChangeEvent, ResultWindowBuffer, dict_query_params

Doc = dict[str, Any]


def test_trim_with_rows_that_are_not_in_the_map() -> None:
    query_params = dict_query_params(
        primary_key="id",
        sort_fields=["age", "id"],
        query_matcher=lambda doc: True,
        sort_comparator=lambda a, b: -1 if (a["age"], a["id"]) < (b["age"], b["id"]) else 1,
        limit=2,
    )
    buffer = ResultWindowBuffer(query_params, 0, 0)
    # the same id twice: the key document map has one entry for two rows
    buffer.reset([{"id": "a", "age": 1}, {"id": "a", "age": 2}])
    assert len(buffer.key_document_map) == 1

    # both rows are pushed out of the window one after the other, the second is not in the map anymore
    first = buffer.apply_change_event(ChangeEvent.insert("0", {"id": "0", "age": 0}))
    second = buffer.apply_change_event(ChangeEvent.insert("1", {"id": "1", "age": 0}))
    assert "runFullQueryAgain" not in (first, second)
    assert [doc["id"] for doc in buffer.results()] == ["0", "1"]
