#![allow(dead_code)]

use event_reduce::{ChangeEvent, QueryParams};

#[derive(Clone, Debug, PartialEq)]
pub struct Human {
    pub id: String,
    pub name: String,
    pub age: u32,
}

pub fn human(id: &str, age: u32) -> Human {
    Human {
        id: id.to_string(),
        name: format!("name-{}", id),
        age,
    }
}

/// SELECT * FROM humans WHERE age > min_age ORDER BY age, id
pub fn query_params(
    min_age: u32,
    skip: Option<usize>,
    limit: Option<usize>,
) -> QueryParams<Human, String> {
    QueryParams {
        get_document_id: |doc| &doc.id,
        skip,
        limit,
        query_matcher: Box::new(move |doc| doc.age > min_age),
        sort_comparator: Box::new(|a, b| a.age.cmp(&b.age).then_with(|| a.id.cmp(&b.id))),
        sort_fields_changed: Box::new(|prev, doc| prev.age != doc.age || prev.id != doc.id),
    }
}

pub fn insert(doc: Human) -> ChangeEvent<Human, String> {
    ChangeEvent::Insert {
        id: doc.id.clone(),
        doc,
    }
}

pub fn update(previous: Human, doc: Human) -> ChangeEvent<Human, String> {
    ChangeEvent::Update {
        id: doc.id.clone(),
        doc,
        previous,
    }
}

pub fn delete(previous: Human) -> ChangeEvent<Human, String> {
    ChangeEvent::Delete {
        id: previous.id.clone(),
        previous,
    }
}
