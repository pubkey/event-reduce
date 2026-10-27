from __future__ import annotations

import pytest

from event_reduce import (
    ORDERED_ACTION_LIST,
    ActionName,
    EventReduceError,
    StateResolveFunctionInput,
    calculate_action_name,
    run_action,
)

from .helper import delete, human, ids, insert, query_params, renamed, update


def test_action_names_match_the_javascript_order() -> None:
    assert [action.value for action in ORDERED_ACTION_LIST] == [
        "doNothing",
        "insertFirst",
        "insertLast",
        "removeFirstItem",
        "removeLastItem",
        "removeFirstInsertLast",
        "removeLastInsertFirst",
        "removeFirstInsertFirst",
        "removeLastInsertLast",
        "removeExisting",
        "replaceExisting",
        "alwaysWrong",
        "insertAtSortPosition",
        "removeExistingAndInsertAtSortPosition",
        "insertAtSortPositionRemoveLast",
        "insertAtSortPositionRemoveFirst",
        "runFullQueryAgain",
        "unknownAction",
    ]


def test_run_full_query_again_raises() -> None:
    results = [human("a", 1)]
    with pytest.raises(EventReduceError, match="EventReduce:RUN_FULL"):
        run_action(ActionName.RUN_FULL_QUERY_AGAIN, query_params(0), insert(human("b", 1)), results)
    assert ids(results) == ["a"]


def test_remove_existing_keeps_the_map_in_sync() -> None:
    results = [human("a", 1), human("b", 2), human("c", 3)]
    key_document_map = {d.id: d for d in results}
    run_action(ActionName.REMOVE_EXISTING, query_params(0), delete(human("b", 2)), results, key_document_map)
    assert ids(results) == ["a", "c"]
    assert sorted(key_document_map) == ["a", "c"]


def test_replace_existing_at_the_same_position() -> None:
    results = [human("a", 1), human("b", 2), human("c", 3)]
    new = renamed(human("b", 2), "new")
    run_action(ActionName.REPLACE_EXISTING, query_params(0), update(human("b", 2), new), results)
    assert results[1] is new


def test_insert_at_sort_position() -> None:
    params = query_params(0)
    results: list = []
    for doc in [human("b", 5), human("d", 9), human("a", 5), human("c", 7)]:
        run_action(ActionName.INSERT_AT_SORT_POSITION, params, insert(doc), results)
    assert ids(results) == ["a", "b", "c", "d"]
    # inserting a document that is already in the results does nothing
    run_action(ActionName.INSERT_AT_SORT_POSITION, params, insert(human("c", 7)), results)
    assert ids(results) == ["a", "b", "c", "d"]


def test_insert_at_sort_position_remove_last_and_first() -> None:
    params = query_params(0, limit=3)
    results = [human("a", 1), human("c", 3), human("e", 5)]
    key_document_map = {d.id: d for d in results}
    run_action(ActionName.INSERT_AT_SORT_POSITION_REMOVE_LAST, params, insert(human("b", 2)), results, key_document_map)
    assert ids(results) == ["a", "b", "c"]
    run_action(
        ActionName.INSERT_AT_SORT_POSITION_REMOVE_FIRST, params, insert(human("d", 4)), results, key_document_map
    )
    assert ids(results) == ["b", "c", "d"]
    assert sorted(key_document_map) == ["b", "c", "d"]


def test_calculate_and_run_an_action() -> None:
    params = query_params(10, limit=10)
    results = [human("a", 20), human("b", 30)]
    event = insert(human("c", 25))
    action = calculate_action_name(StateResolveFunctionInput(params, event, results))
    assert action == ActionName.INSERT_AT_SORT_POSITION
    assert ids(run_action(action, params, event, results)) == ["a", "c", "b"]
