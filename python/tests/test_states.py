from __future__ import annotations

from event_reduce import (
    ORDERED_STATE_LIST,
    ChangeEvent,
    QueryParams,
    StateName,
    StateResolveFunctionInput,
    get_property,
    get_state_set,
    resolve_state,
)

from .helper import Human, delete, human, insert, query_params, renamed, update


def resolve(
    state: StateName,
    params: QueryParams[Human],
    event: ChangeEvent[Human],
    results: list[Human],
    key_document_map: dict[str, Human] | None = None,
) -> bool:
    return resolve_state(state, StateResolveFunctionInput(params, event, list(results), key_document_map))


def test_state_names_match_the_javascript_order() -> None:
    assert [state.value for state in ORDERED_STATE_LIST] == [
        "isInsert",
        "isUpdate",
        "isDelete",
        "hasLimit",
        "isFindOne",
        "hasSkip",
        "wasResultsEmpty",
        "wasLimitReached",
        "wasFirst",
        "wasLast",
        "sortParamsChanged",
        "wasInResult",
        "wasSortedBeforeFirst",
        "wasSortedAfterLast",
        "isSortedBeforeFirst",
        "isSortedAfterLast",
        "wasMatching",
        "doesMatchNow",
    ]


def test_limit_and_skip() -> None:
    event = insert(human("a", 20))
    params = query_params(0, skip=2, limit=1)
    assert resolve(StateName.HAS_LIMIT, params, event, [])
    assert resolve(StateName.IS_FIND_ONE, params, event, [])
    assert resolve(StateName.HAS_SKIP, params, event, [])
    assert resolve(StateName.WAS_LIMIT_REACHED, params, event, [human("b", 1)])
    params = query_params(0, skip=0)
    assert not resolve(StateName.HAS_LIMIT, params, event, [])
    assert not resolve(StateName.HAS_SKIP, params, event, [])


def test_sort_params_changed() -> None:
    params = query_params(0)
    a = human("a", 1)
    assert not resolve(StateName.SORT_PARAMS_CHANGED, params, update(a, renamed(a, "other")), [])
    assert resolve(StateName.SORT_PARAMS_CHANGED, params, update(a, human("a", 2)), [])
    assert resolve(StateName.SORT_PARAMS_CHANGED, params, insert(a), [])
    assert not resolve(StateName.SORT_PARAMS_CHANGED, params, delete(a), [])


def test_was_in_result_with_and_without_map() -> None:
    params = query_params(0)
    event = update(human("b", 1), human("b", 2))
    results = [human("a", 1), human("b", 1)]
    assert resolve(StateName.WAS_IN_RESULT, params, event, results)
    assert not resolve(StateName.WAS_IN_RESULT, params, event, results[:1])
    assert resolve(StateName.WAS_IN_RESULT, params, event, results, {d.id: d for d in results})


def test_is_sorted_compares_with_the_neighbor_when_the_changed_document_is_first_or_last() -> None:
    params = query_params(0)
    results = [human("a", 1), human("b", 5), human("c", 10)]
    # the first document moves behind the second one
    assert not resolve(StateName.IS_SORTED_BEFORE_FIRST, params, update(human("a", 1), human("a", 7)), results)
    # the last document stays last
    assert resolve(StateName.IS_SORTED_AFTER_LAST, params, update(human("c", 10), human("c", 20)), results)
    # without a neighbor, the changed document is still first and last
    event = update(human("a", 1), human("a", 7))
    assert resolve(StateName.IS_SORTED_BEFORE_FIRST, params, event, results[:1])
    assert resolve(StateName.IS_SORTED_AFTER_LAST, params, event, results[:1])


def test_state_set() -> None:
    input = StateResolveFunctionInput(query_params(0), insert(human("a", 1)), [])
    assert get_state_set(input) == "100000100010000001"


def test_get_property() -> None:
    doc = {"a": {"b": [{"c": 1}]}, "d": None}
    assert get_property(doc, "a.b.0.c") == 1
    assert get_property(doc, "a.x", "default") == "default"
    assert get_property(doc, "d", "default") == "default"
