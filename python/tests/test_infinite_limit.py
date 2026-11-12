"""An infinite limit (math.inf) means no limit, like Infinity in the JavaScript implementation."""

from __future__ import annotations

import math
from typing import Any

from event_reduce import (
    ChangeEvent,
    QueryParams,
    ResultWindowBuffer,
    dict_query_params,
    get_recommended_result_window_buffer_size,
)

Doc = dict[str, Any]
A: Doc = {"id": "a", "age": 1}
B: Doc = {"id": "b", "age": 2}
C: Doc = {"id": "c", "age": 3}


def query_params(skip: int | None = None) -> QueryParams[Doc]:
    return dict_query_params(
        primary_key="id",
        sort_fields=["age", "id"],
        query_matcher=lambda doc: True,
        sort_comparator=lambda a, b: -1 if (a["age"], a["id"]) < (b["age"], b["id"]) else 1,
        skip=skip,
        limit=math.inf,  # type: ignore[arg-type]
    )


def test_recommended_buffer_size() -> None:
    assert get_recommended_result_window_buffer_size(math.inf) == 30  # type: ignore[arg-type]
    assert get_recommended_result_window_buffer_size(10**9) == 30


def test_buffer_query_has_no_limit() -> None:
    buffer = ResultWindowBuffer(query_params(skip=3), 2, 1)
    query = buffer.query()
    assert (query.skip, query.limit) == (2, None)


def test_buffer_works_like_without_a_limit() -> None:
    buffer = ResultWindowBuffer(query_params(skip=1), 1, 1)
    buffer.reset([A, B])
    assert buffer.complete
    assert buffer.results() == [B]
    assert buffer.apply_change_event(ChangeEvent.insert("c", C)) == "eventReduce"
    assert buffer.results() == [B, C]
    assert buffer.apply_change_event(ChangeEvent.delete("a", A)) != "runFullQueryAgain"
    assert buffer.results() == [C]
