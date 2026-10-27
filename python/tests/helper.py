from __future__ import annotations

import json
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from event_reduce import ChangeEvent, QueryParams, WriteOperation, dict_query_params

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Human:
    id: str
    age: int
    name: str = ""


def human(id: str, age: int) -> Human:
    return Human(id, age, "name-" + id)


def renamed(doc: Human, name: str) -> Human:
    return replace(doc, name=name)


def compare(a: Human, b: Human) -> int:
    if a.age != b.age:
        return -1 if a.age < b.age else 1
    return -1 if a.id < b.id else 1


def query_params(min_age: int, skip: int | None = None, limit: int | None = None) -> QueryParams[Human]:
    """SELECT * FROM humans WHERE age > min_age ORDER BY age, id"""
    return QueryParams(
        get_document_id=lambda doc: doc.id,
        query_matcher=lambda doc: doc.age > min_age,
        sort_comparator=compare,
        sort_fields_changed=lambda previous, doc: previous.age != doc.age,
        skip=skip,
        limit=limit,
    )


def insert(doc: Human) -> ChangeEvent[Human]:
    return ChangeEvent.insert(doc.id, doc)


def update(previous: Human, doc: Human) -> ChangeEvent[Human]:
    return ChangeEvent.update(doc.id, doc, previous)


def delete(previous: Human) -> ChangeEvent[Human]:
    return ChangeEvent.delete(previous.id, previous)


def ids(docs: list[Human]) -> list[str]:
    return [doc.id for doc in docs]


def load_port_test_cases() -> list[dict[str, Any]]:
    """The test cases that the JavaScript implementation created, see javascript/test/helper/port-test-cases.ts"""
    path = REPOSITORY_ROOT / "javascript" / "test" / "fixtures" / "port-test-cases.json"
    cases: list[dict[str, Any]] = json.loads(path.read_text(encoding="utf-8"))
    return cases


def port_test_query_params(query: dict[str, Any]) -> QueryParams[dict[str, Any]]:
    """The query of the port test cases: age > minAge, sorted by age, then by id."""
    min_age = query["minAge"]

    def sort_comparator(a: dict[str, Any], b: dict[str, Any]) -> int:
        if a["age"] != b["age"]:
            return -1 if a["age"] < b["age"] else 1
        return -1 if a["id"] < b["id"] else 1

    return dict_query_params(
        primary_key="id",
        sort_fields=["age", "id"],
        query_matcher=lambda doc: bool(doc["age"] > min_age),
        sort_comparator=sort_comparator,
        skip=query["skip"],
        limit=query["limit"],
    )


def port_test_change_event(change_event: dict[str, Any]) -> ChangeEvent[dict[str, Any]]:
    return ChangeEvent(
        WriteOperation(change_event["operation"]), change_event["id"], change_event["doc"], change_event["previous"]
    )
