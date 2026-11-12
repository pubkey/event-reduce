"""Like in SQL, a query with limit 0 returns no documents. A negative limit raises."""

from __future__ import annotations

from typing import Any

import pytest

from event_reduce import (
    ActionName,
    ChangeEvent,
    EventReduceError,
    QueryParams,
    ResultWindowBuffer,
    StateResolveFunctionInput,
    calculate_action_name,
    dict_query_params,
)

Doc = dict[str, Any]
A: Doc = {"id": "a", "age": 1}
EVENTS = [
    ChangeEvent.insert("a", A),
    ChangeEvent.update("a", {"id": "a", "age": 2}, A),
    ChangeEvent.delete("a", A),
]


def query_params(limit: int | None, skip: int | None = None) -> QueryParams[Doc]:
    return dict_query_params(
        primary_key="id",
        sort_fields=["age", "id"],
        query_matcher=lambda doc: True,
        sort_comparator=lambda a, b: -1 if (a["age"], a["id"]) < (b["age"], b["id"]) else 1,
        skip=skip,
        limit=limit,
    )


@pytest.mark.parametrize("skip", [None, 0, 3])
@pytest.mark.parametrize("event", EVENTS)
def test_limit_zero_is_always_do_nothing(event: ChangeEvent[Doc], skip: int | None) -> None:
    action = calculate_action_name(StateResolveFunctionInput(query_params(0, skip), event, []))
    assert action == ActionName.DO_NOTHING


def test_other_limits_are_not_changed() -> None:
    for limit in (1, None):
        action = calculate_action_name(StateResolveFunctionInput(query_params(limit), EVENTS[0], []))
        assert action == ActionName.INSERT_FIRST


def test_negative_limit_raises() -> None:
    with pytest.raises(EventReduceError) as error:
        calculate_action_name(StateResolveFunctionInput(query_params(-1), EVENTS[0], []))
    assert error.value.code == "NEG_LIMIT"
    with pytest.raises(EventReduceError) as error:
        ResultWindowBuffer(query_params(-1))
    assert error.value.code == "NEG_LIMIT"
    ResultWindowBuffer(query_params(0))
