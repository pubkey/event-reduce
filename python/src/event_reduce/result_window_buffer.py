"""
Result window buffer
------------
For a query with a limit or a skip, EventReduce returns runFullQueryAgain
when a row has to move into the result window that is not in the previous results:
the row after the last row (a row left a full window) or the last skipped row
(a row was added in front of the window).
The result window buffer keeps rows on both sides of the window in memory,
so these rows can be taken from memory instead.
See docs/result-window-buffer.md for the explanation and measurements.

Invariant: `buffer` is always an exact, contiguous slice of the full sorted result
(without skip and limit): exactly `offset` matching rows sort before its first row,
and it never contains a wrong row or misses a row in between.
If `complete` is true, there are no rows after its last row.
Only if the buffer is empty, `offset` can be larger than the real number of rows.
"""

from __future__ import annotations

import math
from collections.abc import Iterable
from dataclasses import dataclass, field
from enum import Enum
from typing import Generic, NamedTuple, TypeVar

from .actions import ACTION_FUNCTIONS, ORDERED_ACTION_LIST
from .bdd import resolve_input
from .types import ActionName, ChangeEvent, EventReduceError, QueryParams, StateResolveFunctionInput

D = TypeVar("D")

BufferSize = int | float
"""A whole number of rows, or math.inf to keep all rows on that side."""


class ResultWindowBufferResult(str, Enum):
    """What apply_change_event() did."""

    EVENT_REDUCE = "eventReduce"
    """An EventReduce action calculated the new buffer."""
    BUFFER = "buffer"
    """EventReduce could not do it (or would have dropped a row), the slice rule did it."""
    RUN_FULL_QUERY_AGAIN = "runFullQueryAgain"
    """The caller must run the query with the skip and limit of query() and pass the rows to reset()."""


class ResultWindowBufferQuery(NamedTuple):
    """The skip and limit to run the query of the buffer with, limit is None if all rows after the skip are needed."""

    skip: int
    limit: int | None


@dataclass(frozen=True)
class ResultWindowBufferChangeResult(Generic[D]):
    """
    What apply_change_events() returns.
    results are the rows of the original skip and limit,
    changed is true if they are not the same rows as before the change events.
    """

    run_full_query_again: bool
    changed: bool = False
    results: list[D] = field(default_factory=list)


ACTIONS_THAT_DROP_A_ROW = frozenset(
    {
        ActionName.REMOVE_FIRST_ITEM,
        ActionName.REMOVE_LAST_ITEM,
        ActionName.REMOVE_FIRST_INSERT_LAST,
        ActionName.REMOVE_LAST_INSERT_FIRST,
        ActionName.REMOVE_FIRST_INSERT_FIRST,
        ActionName.REMOVE_LAST_INSERT_LAST,
        ActionName.INSERT_AT_SORT_POSITION_REMOVE_LAST,
        ActionName.INSERT_AT_SORT_POSITION_REMOVE_FIRST,
    }
)
"""Actions that keep the length of the result by dropping its first or last row. The slice rule can keep that row."""


def get_recommended_result_window_buffer_size(limit: int | None = None) -> int:
    """
    The recommended buffer size for each side of the result window.
    About log2(limit) for small limits, grows faster around limit 400 and is at most 30.
    Returns 0 for a limit of 1 (like a find-one query) and for queries without a limit.
    """
    if not limit:
        return 0
    return min(30, math.floor(math.log2(limit) + 19 / (1 + (400 / limit) ** 2)))


def _to_buffer_size(size: BufferSize | None) -> BufferSize:
    """
    Buffer sizes are whole numbers, rounded down. Not set means 0,
    math.inf keeps all rows on that side.
    Raises on negative sizes and on values that are not numbers, like NaN.
    """
    if size is None:
        return 0
    if isinstance(size, bool) or not isinstance(size, (int, float)) or math.isnan(size) or size < 0:
        raise EventReduceError("RWB_SIZE")
    return size if math.isinf(size) else math.floor(size)


class ResultWindowBuffer(Generic[D]):
    """
    Keeps rows on both sides of the result window of a query with a skip or limit in memory.
    Create it, run the query with the skip and limit of query()
    and pass the rows to reset() before using it.
    """

    def __init__(
        self,
        query_params: QueryParams[D],
        limit_buffer_size: BufferSize | None = None,
        skip_buffer_size: BufferSize | None = None,
    ) -> None:
        self.query_params = query_params
        """QueryParams of the original query, with the skip and limit that are shown to the user."""
        limit_size = _to_buffer_size(limit_buffer_size)
        skip_size = _to_buffer_size(skip_buffer_size)
        # with limit 0 the result is always empty, so no rows are kept
        is_empty_query = query_params.limit == 0
        self.limit_buffer_size: BufferSize = 0 if is_empty_query else limit_size
        """Amount of rows to keep after the last row of the result window."""
        self.skip_buffer_size: BufferSize = 0 if is_empty_query else skip_size
        """Amount of rows to keep before the first row of the result window, out of the skipped rows."""
        self.buffer: list[D] = []
        self.key_document_map: dict[str, D] = {}
        self.offset = 0
        """Number of matching rows that sort before the first row of the buffer."""
        self.complete = False
        """True if there are no rows after the last row of the buffer."""

    def _skip(self) -> int:
        return self.query_params.skip or 0

    def query(self) -> ResultWindowBufferQuery:
        """The skip and limit to run the query of the buffer with."""
        skip = self._skip()
        buffer_skip = max(0, skip - self.skip_buffer_size)
        limit = self.query_params.limit
        buffer_limit = None
        if limit is not None and not math.isinf(self.limit_buffer_size):
            buffer_limit = int((skip - buffer_skip) + limit + self.limit_buffer_size)
        return ResultWindowBufferQuery(int(buffer_skip), buffer_limit)

    def reset(self, rows: Iterable[D]) -> None:
        """Set the buffer to the rows of a fresh query that ran with the skip and limit of query()."""
        query = self.query()
        get_id = self.query_params.get_document_id
        self.buffer = list(rows)
        self.key_document_map = {get_id(doc): doc for doc in self.buffer}
        self.offset = query.skip
        # fewer rows than requested means there are no more rows
        self.complete = query.limit is None or len(self.buffer) < query.limit

    def results(self) -> list[D]:
        """
        The result that is shown to the user.
        Raises if the result window is not in the buffer, which happens
        before reset() was called or when apply_change_event() returned RUN_FULL_QUERY_AGAIN
        and the query did not run again.
        """
        if not self._is_result_window_in_buffer():
            raise EventReduceError("RWB_OUTDATED")
        start = self._skip() - self.offset
        limit = self.query_params.limit
        return self.buffer[start : None if limit is None else start + limit]

    def apply_change_event(self, change_event: ChangeEvent[D]) -> ResultWindowBufferResult:
        """Updates the buffer with the change event."""
        buffer = self.buffer
        if self.query_params.limit == 0:
            # the result of a query with limit 0 is always empty, nothing can change it
            return ResultWindowBufferResult.EVENT_REDUCE
        if not self.complete and not buffer:
            return ResultWindowBufferResult.RUN_FULL_QUERY_AGAIN

        # 1. Let EventReduce handle the buffer as if it was the result of a query
        # with skip = offset and limit = len(buffer). This is exactly true,
        # because the buffer is an exact slice of the full result.
        # If the buffer is complete, we use len(buffer) + 1, so EventReduce
        # knows that the limit is not reached and there are no more rows.
        input = StateResolveFunctionInput(
            query_params=self.query_params.with_skip_and_limit(
                self.offset if self.offset > 0 else None,
                len(buffer) + 1 if self.complete else len(buffer),
            ),
            change_event=change_event,
            previous_results=buffer,
            key_document_map=self.key_document_map,
        )
        action = ORDERED_ACTION_LIST[resolve_input(input)]
        if action in (ActionName.RUN_FULL_QUERY_AGAIN, ActionName.UNKNOWN_ACTION) or action in ACTIONS_THAT_DROP_A_ROW:
            # 2. EventReduce needs a row before or after the buffer, which it does not know,
            # or it would drop a row to keep the length of the result.
            # But the buffer does not have to keep its length, only to stay an exact slice,
            # so the slice rule lets it shrink or grow instead.
            self._apply_slice_rule(change_event)
            result = ResultWindowBufferResult.BUFFER
        else:
            ACTION_FUNCTIONS[action](input)
            result = ResultWindowBufferResult.EVENT_REDUCE

        # 3. Do not let the buffer grow without bounds on either side.
        self._trim()

        # 4. Run the query again if the result window does not fit into the buffer anymore.
        if not self._is_result_window_in_buffer():
            return ResultWindowBufferResult.RUN_FULL_QUERY_AGAIN
        return result

    def apply_change_events(self, change_events: Iterable[ChangeEvent[D]]) -> ResultWindowBufferChangeResult[D]:
        """
        Updates the buffer with all change events.
        Returns the new results, and if they changed,
        or run_full_query_again if the result window does not fit into the buffer anymore.
        Then run the query of query() and pass the rows to reset().
        """
        if not self._is_result_window_in_buffer():
            return ResultWindowBufferChangeResult(run_full_query_again=True)
        previous_results = self.results()
        for change_event in change_events:
            if self.apply_change_event(change_event) == ResultWindowBufferResult.RUN_FULL_QUERY_AGAIN:
                return ResultWindowBufferChangeResult(run_full_query_again=True)
        results = self.results()
        # Changed rows are always new objects from the change events,
        # so comparing the rows by reference finds every change.
        changed = len(results) != len(previous_results) or any(
            row is not previous for row, previous in zip(results, previous_results, strict=False)
        )
        return ResultWindowBufferChangeResult(run_full_query_again=False, changed=changed, results=results)

    def _is_result_window_in_buffer(self) -> bool:
        """True if all rows of the result window are in the buffer."""
        start = self._skip() - self.offset
        if start < 0:
            return False
        if self.complete:
            return True
        limit = self.query_params.limit
        return limit is not None and len(self.buffer) >= start + limit

    def _trim(self) -> None:
        """
        Removes rows before the window that are more than skip_buffer_size
        and rows after the window that are more than limit_buffer_size.
        """
        get_id = self.query_params.get_document_id
        rows_before_window = self._skip() - self.offset
        remove_from_start = min(rows_before_window - self.skip_buffer_size, len(self.buffer))
        if remove_from_start > 0:
            remove = int(remove_from_start)
            for doc in self.buffer[:remove]:
                del self.key_document_map[get_id(doc)]
            del self.buffer[:remove]
            self.offset += remove

        limit = self.query_params.limit
        if limit is not None:
            max_length = max(0, self._skip() - self.offset) + limit + self.limit_buffer_size
            if len(self.buffer) > max_length:
                keep = int(max_length)
                for doc in self.buffer[keep:]:
                    del self.key_document_map[get_id(doc)]
                del self.buffer[keep:]
                self.complete = False

    def _apply_slice_rule(self, change_event: ChangeEvent[D]) -> None:
        """
        The slice rule:
        Exactly `offset` matching rows sort before the first row of the buffer,
        and all matching rows that sort between the first and the last row are in the buffer.
        After the change event, this is still true for the old first and last row, so:
        - the old version of the changed row is removed from the buffer,
        - the new version is added if it sorts between the old first and last row,
        - offset changes by one if the changed row moved into or out of the rows before the first row.
        If offset is 0, there are no rows before the first row, so a row that sorts before it is added.
        If the buffer is complete, there are no rows after the last row, so a row that sorts after it is added.

        An empty buffer (only valid when complete) knows only the number of rows before it.
        There, offset is only an upper bound, which stays an upper bound with the same update.
        """
        query_params = self.query_params
        buffer = self.buffer
        previous = change_event.previous
        doc = change_event.doc
        was_matching = previous is not None and query_params.query_matcher(previous)
        does_match_now = doc is not None and query_params.query_matcher(doc)

        if not buffer:
            if self.offset == 0:
                # there are no rows at all
                if doc is not None and does_match_now:
                    self._insert_at_sort_position(doc)
            else:
                self.offset += int(does_match_now) - int(was_matching)
            return

        first = buffer[0]
        last = buffer[-1]
        has_rows_before = self.offset > 0
        was_before = previous is not None and was_matching and has_rows_before and self._compare(previous, first) < 0
        is_before_now = doc is not None and does_match_now and has_rows_before and self._compare(doc, first) < 0

        id = change_event.id
        if self.key_document_map.pop(id, None) is not None:
            get_id = query_params.get_document_id
            index = next(i for i, row in enumerate(buffer) if get_id(row) == id)
            del buffer[index]
        if (
            doc is not None
            and does_match_now
            and not is_before_now
            and (self.complete or self._compare(doc, last) <= 0)
        ):
            self._insert_at_sort_position(doc)
        self.offset += int(is_before_now) - int(was_before)

    def _compare(self, a: D, b: D) -> int:
        """
        Compares two rows with the sort comparator of the query.
        Returns 0 only for two versions of the same row that sort at the same position.
        For different rows that the comparator sees as equal,
        the primary key decides, so that the order is always deterministic.
        """
        query_params = self.query_params
        id_a = query_params.get_document_id(a)
        id_b = query_params.get_document_id(b)
        result = _sign(query_params.sort_comparator(a, b))
        if id_a == id_b:
            # A deterministic comparator breaks ties by the primary key,
            # which gives the same answer for both directions when the sort values are equal.
            if result == 0 or result == _sign(query_params.sort_comparator(b, a)):
                return 0
            return result
        if result != 0:
            return result
        return -1 if id_a < id_b else 1

    def _insert_at_sort_position(self, doc: D) -> None:
        buffer = self.buffer
        # binary search for the first row that sorts after doc
        low = 0
        high = len(buffer)
        while low < high:
            mid = (low + high) >> 1
            if self._compare(buffer[mid], doc) < 0:
                low = mid + 1
            else:
                high = mid
        buffer.insert(low, doc)
        self.key_document_map[self.query_params.get_document_id(doc)] = doc


def _sign(value: int) -> int:
    return (value > 0) - (value < 0)
