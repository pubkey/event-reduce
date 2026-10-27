from __future__ import annotations

from event_reduce import (
    ORDERED_ACTION_LIST,
    ORDERED_STATE_LIST,
    PACKED_BDD,
    PACKED_BDD_STRING,
    StateResolveFunctionInput,
    calculate_action_name,
    get_state_set,
)

from .helper import REPOSITORY_ROOT, load_port_test_cases, port_test_change_event, port_test_query_params


def test_packed_bdd_string_is_the_same_as_in_the_javascript_implementation() -> None:
    js = (REPOSITORY_ROOT / "javascript" / "src" / "bdd" / "bdd.generated.ts").read_text(encoding="utf-8")
    assert f"export const packedBddString = '{PACKED_BDD_STRING}';" in js, (
        "python bdd_generated.py is out of sync with the JavaScript BDD"
    )


def test_packed_bdd_only_references_known_states_and_actions() -> None:
    assert len(PACKED_BDD) % 3 == 0
    n = len(PACKED_BDD) // 3
    for i in range(0, len(PACKED_BDD), 3):
        assert PACKED_BDD[i] < len(ORDERED_STATE_LIST)
        for ref in (PACKED_BDD[i + 1], PACKED_BDD[i + 2]):
            assert ref < n or ref - n < len(ORDERED_ACTION_LIST)


def test_same_state_set_and_action_as_the_javascript_implementation() -> None:
    cases = load_port_test_cases()
    assert len(cases) > 100
    for index, case in enumerate(cases):
        input = StateResolveFunctionInput(
            query_params=port_test_query_params(case["query"]),
            change_event=port_test_change_event(case["changeEvent"]),
            previous_results=list(case["previousResults"]),
        )
        assert get_state_set(input) == case["stateSet"], f"state set of case #{index}"
        assert calculate_action_name(input).value == case["action"], f"action of case #{index}"
