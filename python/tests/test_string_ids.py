"""Document ids must be strings in all implementations, numbers are not allowed."""

from __future__ import annotations

from typing import Any

import pytest

from event_reduce import (
    ActionName,
    ChangeEvent,
    EventReduceError,
    StateResolveFunctionInput,
    calculate_action_name,
    dict_query_params,
)

Doc = dict[str, Any]
QUERY_PARAMS = dict_query_params(
    primary_key="id",
    sort_fields=["age"],
    query_matcher=lambda doc: True,
    sort_comparator=lambda a, b: -1 if (a["age"], str(a["id"])) < (b["age"], str(b["id"])) else 1,
)


@pytest.mark.parametrize("id", [1, 0, None, 1.5, b"a"])
def test_change_event_id_must_be_a_string(id: Any) -> None:
    for create in (
        lambda: ChangeEvent.insert(id, {"id": id, "age": 1}),
        lambda: ChangeEvent.update(id, {"id": id, "age": 2}, {"id": id, "age": 1}),
        lambda: ChangeEvent.delete(id, {"id": id, "age": 1}),
    ):
        with pytest.raises(EventReduceError) as error:
            create()
        assert error.value.code == "ID_NOT_STRING"


def test_document_id_must_be_a_string() -> None:
    # before, the number was converted to "1" and did not match the documents anymore
    with pytest.raises(EventReduceError) as error:
        QUERY_PARAMS.get_document_id({"id": 1, "age": 1})
    assert error.value.code == "ID_NOT_STRING"

    event = ChangeEvent.insert("b", {"id": "b", "age": 2})
    with pytest.raises(EventReduceError) as error:
        calculate_action_name(StateResolveFunctionInput(QUERY_PARAMS, event, [{"id": 1, "age": 1}]))
    assert error.value.code == "ID_NOT_STRING"


def test_string_ids_work() -> None:
    assert QUERY_PARAMS.get_document_id({"id": "1", "age": 1}) == "1"
    event = ChangeEvent.insert("2", {"id": "2", "age": 2})
    action = calculate_action_name(StateResolveFunctionInput(QUERY_PARAMS, event, [{"id": "1", "age": 1}]))
    assert action == ActionName.INSERT_LAST
