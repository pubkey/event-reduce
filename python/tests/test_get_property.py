"""get_property() must behave like getProperty() of the JavaScript implementation."""

from __future__ import annotations

from event_reduce import get_property


def test_reads_nested_values() -> None:
    doc = {"a": {"b": 1}, "items": [{"rank": 5}, {"rank": 7}], "pair": (1, 2)}
    assert get_property(doc, "a.b") == 1
    assert get_property(doc, "items.1.rank") == 7
    assert get_property(doc, "pair.0") == 1
    assert get_property(doc, "items.10.rank", "default") == "default"


def test_returns_the_default_for_a_missing_path() -> None:
    assert get_property({"a": {}}, "a.b", "default") == "default"
    assert get_property({"a": None}, "a.b", "default") == "default"
    assert get_property({"a": 1}, "a.b", "default") == "default"
    assert get_property(None, "a", "default") == "default"
    assert get_property({}, "a") is None


def test_returns_a_none_value_that_exists() -> None:
    # like null in JavaScript, only a missing value gives the default
    assert get_property({"a": None}, "a", "default") is None
    assert get_property({"a": {"b": None}}, "a.b", "default") is None
    assert get_property({"a": [None]}, "a.0", "default") is None


def test_only_plain_numbers_are_list_indexes() -> None:
    doc = {"a": [1, 2]}
    # str.isdigit() is true for '²', but it is not a number
    assert get_property(doc, "a.²", "default") == "default"
    assert get_property(doc, "a.01", "default") == "default"
    assert get_property(doc, "a.-1", "default") == "default"
    assert get_property(doc, "a.1", "default") == 2
    assert get_property(doc, "a.0", "default") == 1
