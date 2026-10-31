"""Runs the test suite that all implementations share, see ../test-suite/README.md."""

from __future__ import annotations

import copy
import json
import math
from pathlib import Path
from typing import Any

import pytest

from event_reduce import (
    PACKED_BDD,
    ActionName,
    ChangeEvent,
    EventReduceError,
    QueryParams,
    ResultWindowBuffer,
    StateResolveFunctionInput,
    WriteOperation,
    calculate_action_name,
    dict_query_params,
    get_recommended_result_window_buffer_size,
    get_state_set,
    run_action,
)

TEST_SUITE = Path(__file__).resolve().parents[2] / "test-suite"
Doc = dict[str, Any]


def load(file: str) -> Any:
    return json.loads((TEST_SUITE / file).read_text(encoding="utf-8"))


STATE_SETS = load("state-sets.json")
CASES = load("cases.json")


def query_params(query: dict[str, Any]) -> QueryParams[Doc]:
    direction = -1 if query.get("desc") else 1

    def sort_comparator(a: Doc, b: Doc) -> int:
        if a["age"] != b["age"]:
            return -direction if a["age"] < b["age"] else direction
        return -direction if a["id"] < b["id"] else direction

    return dict_query_params(
        primary_key="id",
        sort_fields=["age", "id"],
        query_matcher=lambda doc: bool(doc["age"] > query["minAge"]),
        sort_comparator=sort_comparator,
        skip=query["skip"],
        limit=query["limit"],
    )


def change_event(event: dict[str, Any]) -> ChangeEvent[Doc]:
    return ChangeEvent(WriteOperation(event["operation"]), event["id"], event["doc"], event["previous"])


def ids(docs: list[Doc]) -> list[str]:
    return [doc["id"] for doc in docs]


def test_state_sets() -> None:
    assert tuple(STATE_SETS["packedBdd"]) == PACKED_BDD, "bdd_generated.py is out of sync with the JavaScript BDD"
    for index, case in enumerate(STATE_SETS["cases"]):
        input = StateResolveFunctionInput(
            query_params(case["query"]), change_event(case["changeEvent"]), list(case["previousResults"])
        )
        assert get_state_set(input) == case["stateSet"], f"state set of case #{index}"
        assert calculate_action_name(input).value == case["action"], f"action of case #{index}"


@pytest.mark.parametrize("case", CASES["actions"], ids=lambda case: case["name"])
def test_actions(case: dict[str, Any]) -> None:
    params = query_params(case["query"])
    event = change_event(copy.deepcopy(case["changeEvent"]))
    results: list[Doc] = copy.deepcopy(case["previousResults"])
    key_document_map = {doc["id"]: doc for doc in results} if case["useKeyDocumentMap"] else None
    if "action" in case:
        action = ActionName(case["action"])
    else:
        action = calculate_action_name(StateResolveFunctionInput(params, event, results, key_document_map))
        assert action.value == case["expectedAction"]
    error = None
    try:
        run_action(action, params, event, results, key_document_map)
    except EventReduceError as err:
        error = err.code
    assert error == case.get("expectedError")
    assert results == case["expectedResults"]
    if key_document_map is not None:
        assert sorted(key_document_map.values(), key=lambda doc: doc["id"]) == case["expectedKeyDocumentMap"]


def buffer_size(size: int | str) -> float:
    return math.inf if size == "all" else size


@pytest.mark.parametrize("scenario", CASES["resultWindowBuffer"], ids=lambda scenario: scenario["name"])
def test_result_window_buffer(scenario: dict[str, Any]) -> None:
    buffer = ResultWindowBuffer(
        query_params(scenario["query"]),
        buffer_size(scenario["limitBufferSize"]),
        buffer_size(scenario["skipBufferSize"]),
    )
    for index, step in enumerate(scenario["steps"]):
        context = f"step #{index} {step['op']}"
        op = step["op"]
        if op == "query":
            query = buffer.query()
            assert {"skip": query.skip, "limit": query.limit} == step["expected"], context
        elif op == "reset":
            buffer.reset(copy.deepcopy(step["rows"]))
        elif op == "results":
            results: list[str] | None = None
            error: str | None = None
            try:
                results = ids(buffer.results())
            except EventReduceError as err:
                error = err.code
            assert results == step.get("expected"), context
            assert error == step.get("expectedError"), context
        elif op == "applyChangeEvent":
            result = buffer.apply_change_event(change_event(copy.deepcopy(step["changeEvent"])))
            assert result.value == step["expected"], context
        elif op == "applyChangeEvents":
            change = buffer.apply_change_events([change_event(e) for e in copy.deepcopy(step["changeEvents"])])
            actual: dict[str, Any] = (
                {"runFullQueryAgain": True}
                if change.run_full_query_again
                else {"runFullQueryAgain": False, "changed": change.changed, "results": ids(change.results)}
            )
            assert actual == step["expected"], context
        elif op == "inspect":
            actual = {"buffer": ids(buffer.buffer), "offset": buffer.offset, "complete": buffer.complete}
            assert actual == step["expected"], context
        else:
            raise AssertionError(f"unknown op {op}")


def test_recommended_result_window_buffer_size() -> None:
    for limit, size in CASES["recommendedResultWindowBufferSize"]:
        assert get_recommended_result_window_buffer_size(limit) == size, f"limit {limit}"
