from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any, TypeVar

from .types import QueryParams

D = TypeVar("D")

_MISSING = object()


def get_property(obj: Any, path: str, default: Any = None) -> Any:
    """
    Returns the value at the dot-separated path like 'items.0.rank'.
    List entries are accessed by their index.
    Returns the given default value if the path does not exist.
    """
    for key in path.split("."):
        if isinstance(obj, Mapping):
            obj = obj.get(key, _MISSING)
        elif isinstance(obj, (list, tuple)) and key.isdigit() and int(key) < len(obj):
            obj = obj[int(key)]
        else:
            return default
        if obj is _MISSING or obj is None:
            return default
    return obj


def normalize_sort_field(field: str) -> str:
    """normalizes sort-field, in: '-age', out: 'age'"""
    return field[1:] if field.startswith("-") else field


def dict_query_params(
    primary_key: str,
    sort_fields: Sequence[str],
    query_matcher: Callable[[dict[str, Any]], bool],
    sort_comparator: Callable[[dict[str, Any], dict[str, Any]], int],
    skip: int | None = None,
    limit: int | None = None,
) -> QueryParams[dict[str, Any]]:
    """
    QueryParams for dict documents, like the primaryKey and sortFields of the JavaScript implementation.
    The sort fields can be dot-separated paths and can start with '-'.
    """
    fields = [normalize_sort_field(field) for field in sort_fields]

    def sort_fields_changed(previous: dict[str, Any], doc: dict[str, Any]) -> bool:
        return any(get_property(previous, field) != get_property(doc, field) for field in fields)

    def get_document_id(doc: dict[str, Any]) -> str:
        return str(doc[primary_key])

    return QueryParams(
        get_document_id=get_document_id,
        query_matcher=query_matcher,
        sort_comparator=sort_comparator,
        sort_fields_changed=sort_fields_changed,
        skip=skip,
        limit=limit,
    )


def index_of_document_id(query_params: QueryParams[D], docs: list[D], id: str) -> int:
    """Returns the index of the document with the given id or -1 if it is not in the given documents."""
    get_id = query_params.get_document_id
    for index, doc in enumerate(docs):
        if get_id(doc) == id:
            return index
    return -1


def push_at_sort_position(items: list[D], item: D, compare: Callable[[D, D], int]) -> int:
    """
    Inserts the item at its sort position, which is much faster than re-sorting the list.
    Items that are equal to the new item stay before it.
    Returns the index at which the item was inserted.
    """
    # Shortcut: the item belongs at the end, append() is O(1).
    if not items or compare(items[-1], item) <= 0:
        items.append(item)
        return len(items) - 1
    low = 0
    high = len(items)
    while low < high:
        mid = (low + high) >> 1
        if compare(items[mid], item) <= 0:
            low = mid + 1
        else:
            high = mid
    items.insert(low, item)
    return low
