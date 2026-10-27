from __future__ import annotations

import math

import pytest

from event_reduce import (
    EventReduceError,
    ResultWindowBuffer,
    ResultWindowBufferQuery,
    ResultWindowBufferResult,
    get_recommended_result_window_buffer_size,
)

from .helper import Human, delete, human, ids, insert, query_params, update


def buffer_of(
    min_age: int = -1, skip: int | None = None, limit: int | None = None, limit_size: float = 0, skip_size: float = 0
) -> ResultWindowBuffer[Human]:
    return ResultWindowBuffer(query_params(min_age, skip, limit), limit_size, skip_size)


def test_recommended_size_for_each_limit() -> None:
    expected = [(None, 0), (0, 0), (1, 0), (2, 1), (3, 1), (4, 2), (10, 3), (20, 4), (100, 7), (200, 11)]
    expected += [(500, 20), (1000, 26), (2711, 29), (2712, 30), (100000, 30)]
    for limit, size in expected:
        assert get_recommended_result_window_buffer_size(limit) == size, f"limit {limit}"


def test_query_adds_the_buffer_sizes_to_the_skip_and_limit() -> None:
    assert buffer_of(skip=10, limit=20, limit_size=5, skip_size=3).query() == ResultWindowBufferQuery(7, 28)
    # not below skip 0
    assert buffer_of(skip=2, limit=20, skip_size=5).query() == ResultWindowBufferQuery(0, 22)
    # whole numbers, rounded down
    assert buffer_of(skip=10, limit=20, limit_size=2.5, skip_size=2.5).query() == ResultWindowBufferQuery(8, 24)
    # math.inf keeps all rows
    assert buffer_of(skip=10, limit=20, limit_size=math.inf, skip_size=math.inf).query() == ResultWindowBufferQuery(
        0, None
    )
    # no limit for a query without a limit
    assert buffer_of(skip=10, limit_size=5, skip_size=3).query() == ResultWindowBufferQuery(7, None)


@pytest.mark.parametrize("size", [-1, -0.5, -math.inf, math.nan, "5", True])
def test_raises_on_invalid_buffer_sizes(size: object) -> None:
    with pytest.raises(EventReduceError, match="RWB_SIZE"):
        ResultWindowBuffer(query_params(0), size)  # type: ignore[arg-type]
    with pytest.raises(EventReduceError, match="RWB_SIZE"):
        ResultWindowBuffer(query_params(0), 0, size)  # type: ignore[arg-type]


def test_reset() -> None:
    # asks for a full query and has no results before it got rows
    buffer = buffer_of(limit=2)
    with pytest.raises(EventReduceError, match="RWB_OUTDATED"):
        buffer.results()
    assert buffer.apply_change_event(insert(human("a", 1))) == ResultWindowBufferResult.RUN_FULL_QUERY_AGAIN

    # complete when the query returned fewer rows than requested
    buffer = buffer_of(limit=2, limit_size=2)
    buffer.reset([human("a", 1), human("b", 2), human("c", 3)])
    assert buffer.complete
    assert ids(buffer.results()) == ["a", "b"]

    # shows the rows after the skipped rows of the buffer
    buffer = buffer_of(skip=1, limit=2, skip_size=1)
    buffer.reset([human("a", 1), human("b", 2), human("c", 3)])
    assert buffer.offset == 0
    assert ids(buffer.results()) == ["b", "c"]


def test_refills_the_window_from_the_buffer_when_a_visible_row_is_deleted() -> None:
    buffer = buffer_of(limit=2, limit_size=2)
    buffer.reset([human("a", 1), human("b", 2), human("c", 3), human("d", 4)])
    assert buffer.apply_change_event(delete(human("a", 1))) == ResultWindowBufferResult.BUFFER
    assert ids(buffer.results()) == ["b", "c"]
    assert ids(buffer.buffer) == ["b", "c", "d"]


def test_takes_the_row_from_the_skip_buffer_when_a_row_is_added_in_front_of_the_window() -> None:
    buffer = buffer_of(skip=2, limit=1, skip_size=1)
    # skip 1, limit 2: 'a' is skipped and not in the buffer
    buffer.reset([human("b", 2), human("c", 3)])
    assert ids(buffer.results()) == ["c"]
    assert buffer.apply_change_event(insert(human("x", 0))) == ResultWindowBufferResult.BUFFER
    assert buffer.offset == 2
    assert ids(buffer.results()) == ["b"]


def test_asks_for_a_full_query_when_a_row_is_added_in_front_of_the_window_without_a_skip_buffer() -> None:
    buffer = buffer_of(skip=1, limit=1, limit_size=1)
    buffer.reset([human("b", 2), human("c", 3)])
    assert buffer.apply_change_event(insert(human("x", 0))) == ResultWindowBufferResult.RUN_FULL_QUERY_AGAIN
    with pytest.raises(EventReduceError, match="RWB_OUTDATED"):
        buffer.results()


def test_returns_no_rows_for_a_query_with_limit_0() -> None:
    buffer = buffer_of(skip=2, limit=0, limit_size=2, skip_size=2)
    assert buffer.query() == ResultWindowBufferQuery(2, 0)
    buffer.reset([])
    for event in [insert(human("a", 1)), update(human("a", 1), human("a", 2)), delete(human("a", 2))]:
        assert buffer.apply_change_event(event) == ResultWindowBufferResult.EVENT_REDUCE
        assert buffer.results() == []


def test_apply_change_events_returns_the_new_results_and_if_they_changed() -> None:
    buffer = buffer_of(limit=2, limit_size=3)
    buffer.reset([human("a", 1), human("b", 2), human("c", 3), human("d", 4), human("e", 5)])
    # a row after the result window changes
    not_visible = buffer.apply_change_events([update(human("e", 5), human("e", 6))])
    assert not not_visible.run_full_query_again
    assert not not_visible.changed

    visible = buffer.apply_change_events([delete(human("a", 1)), delete(human("b", 2))])
    assert not visible.run_full_query_again
    assert visible.changed
    assert ids(visible.results) == ["c", "d"]

    # a changed row at the same position is reported as changed
    buffer = buffer_of(limit=2)
    buffer.reset([human("a", 1), human("b", 3)])
    result = buffer.apply_change_events([update(human("a", 1), human("a", 2))])
    assert not result.run_full_query_again
    assert result.changed


def test_apply_change_events_asks_for_a_full_query_when_the_window_does_not_fit_into_the_buffer() -> None:
    buffer = buffer_of(limit=2)
    assert buffer.apply_change_events([]).run_full_query_again
    buffer.reset([human("a", 1), human("b", 2)])
    assert buffer.apply_change_events([delete(human("a", 1))]).run_full_query_again
