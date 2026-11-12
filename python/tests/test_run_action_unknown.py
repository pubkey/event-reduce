"""run_action() with a name that is not an action must raise EventReduceError, like JavaScript."""

from __future__ import annotations

from typing import Any, cast

import pytest

from event_reduce import ChangeEvent, EventReduceError, dict_query_params, run_action

Doc = dict[str, Any]


def test_unknown_action_name_raises_unk_act() -> None:
    query_params = dict_query_params(
        primary_key="id",
        sort_fields=["id"],
        query_matcher=lambda doc: True,
        sort_comparator=lambda a, b: -1 if a["id"] < b["id"] else 1,
    )
    results: list[Doc] = []
    with pytest.raises(EventReduceError) as error:
        run_action(cast(Any, "foo"), query_params, ChangeEvent.insert("a", {"id": "a"}), results)
    assert error.value.code == "UNK_ACT"
    assert results == []
