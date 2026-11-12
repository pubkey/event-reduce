from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from typing import Any, TypeVar

from .types import EventReduceError, QueryParams

D = TypeVar("D")

_MISSING = object()


def get_property(obj: Any, path: str, default: Any = None) -> Any:
    """
    Returns the value at the dot-separated path like 'items.0.rank'.
    List entries are accessed by their index.
    Returns the given default value if the path does not exist.
    """
    return _get_path(obj, path.split("."), default)


def _is_list_index(key: str) -> bool:
    """True for '0', '1', '12', like the index of a JavaScript array. Not for '01', '-1' or '²'."""
    return key.isascii() and key.isdigit() and (key == "0" or not key.startswith("0"))


def _get_path(obj: Any, keys: list[str], default: Any = None) -> Any:
    for key in keys:
        if isinstance(obj, Mapping):
            obj = obj.get(key, _MISSING)
        elif isinstance(obj, (list, tuple)) and _is_list_index(key) and int(key) < len(obj):
            obj = obj[int(key)]
        else:
            # also when obj is None: the path goes on below a value that has no fields
            return default
        if obj is _MISSING:
            return default
    return obj


def _differs(a: Any, b: Any) -> bool:
    """
    Like !== of JavaScript for the values of sort fields:
    True and 1 are different values (in Python, True == 1), and so are None and a missing field.
    """
    if a is b:
        return False
    return isinstance(a, bool) != isinstance(b, bool) or bool(a != b)


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
    # Like JavaScript, fields without a dot are read directly, paths are split only once.
    fields: list[str] = []
    paths: list[list[str]] = []
    for sort_field in sort_fields:
        field = normalize_sort_field(sort_field)
        if "." in field:
            paths.append(field.split("."))
        else:
            fields.append(field)

    def sort_fields_changed(previous: dict[str, Any], doc: dict[str, Any]) -> bool:
        for field in fields:
            if _differs(previous.get(field, _MISSING), doc.get(field, _MISSING)):
                return True
        for path in paths:
            if _differs(_get_path(previous, path, _MISSING), _get_path(doc, path, _MISSING)):
                return True
        return False

    def get_document_id(doc: dict[str, Any]) -> str:
        id = doc[primary_key]
        # document ids must be strings in all implementations, numbers are not allowed
        if not isinstance(id, str):
            raise EventReduceError("ID_NOT_STRING")
        return id

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


def push_at_sort_position(items: list[D], item: D, compare: Callable[[D, D], int]) -> None:
    """
    Inserts the item at its sort position, which is much faster than re-sorting the list.
    Items that are equal to the new item stay before it.
    """
    # Shortcut: the item belongs at the end, append() is O(1).
    if not items or compare(items[-1], item) <= 0:
        items.append(item)
        return
    low = 0
    high = len(items)
    while low < high:
        mid = (low + high) >> 1
        if compare(items[mid], item) <= 0:
            low = mid + 1
        else:
            high = mid
    items.insert(low, item)
