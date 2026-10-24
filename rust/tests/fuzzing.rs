//! Applies random change events and checks that the results of EventReduce
//! are equal to the results of running the full query over the database again.

use std::collections::{BTreeMap, HashMap};

use event_reduce::*;

mod common;
use common::*;

/// xorshift, so the tests need no dependencies and are reproducible.
struct Random(u64);

impl Random {
    fn next(&mut self, max: usize) -> usize {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        (self.0 % max as u64) as usize
    }
}

fn run_full_query(params: &QueryParams<Human, String>, db: &BTreeMap<String, Human>) -> Vec<Human> {
    let mut all: Vec<Human> = db
        .values()
        .filter(|d| (params.query_matcher)(d))
        .cloned()
        .collect();
    all.sort_by(|a, b| (params.sort_comparator)(a, b));
    let start = params.skip.unwrap_or(0).min(all.len());
    let end = match params.limit {
        Some(limit) => (start + limit).min(all.len()),
        None => all.len(),
    };
    all[start..end].to_vec()
}

fn fuzz(seed: u64, skip: Option<usize>, limit: Option<usize>, use_map: bool) -> (usize, usize) {
    let mut random = Random(seed);
    let params = query_params(10, skip, limit);
    let mut db: BTreeMap<String, Human> = BTreeMap::new();
    let mut results = run_full_query(&params, &db);
    let mut map: HashMap<String, Human> = HashMap::new();
    let mut optimized = 0;
    let rounds = 1000;
    for i in 0..rounds {
        let ids: Vec<String> = db.keys().cloned().collect();
        let event = if ids.is_empty() || random.next(3) == 0 {
            let doc = human(&format!("doc{}", i), random.next(40) as u32);
            db.insert(doc.id.clone(), doc.clone());
            insert(doc)
        } else {
            let id = &ids[random.next(ids.len())];
            let previous = db[id].clone();
            if random.next(3) == 0 {
                db.remove(id);
                delete(previous)
            } else {
                let mut doc = previous.clone();
                if random.next(4) == 0 {
                    doc.name = format!("renamed{}", i);
                } else {
                    doc.age = random.next(40) as u32;
                }
                db.insert(id.clone(), doc.clone());
                update(previous, doc)
            }
        };

        let action = calculate_action_name(&StateResolveFunctionInput {
            query_params: &params,
            change_event: &event,
            previous_results: &results,
            key_document_map: if use_map { Some(&map) } else { None },
        });
        assert_ne!(action, ActionName::UnknownAction, "state set must be known");
        if action == ActionName::RunFullQueryAgain {
            results = run_full_query(&params, &db);
            map = results.iter().map(|d| (d.id.clone(), d.clone())).collect();
        } else {
            optimized += 1;
            run_action(
                action,
                &params,
                &event,
                &mut results,
                if use_map { Some(&mut map) } else { None },
            )
            .unwrap();
            let expected = run_full_query(&params, &db);
            assert_eq!(
                results, expected,
                "wrong results after action {} on event {:?} (seed {})",
                action, event, seed
            );
            if use_map {
                assert_eq!(map.len(), results.len());
                for doc in &results {
                    assert_eq!(map.get(&doc.id), Some(doc));
                }
            }
        }
    }
    (optimized, rounds)
}

#[test]
fn same_results_as_running_the_full_query() {
    let cases: [(Option<usize>, Option<usize>, bool); 7] = [
        (None, None, false),
        (None, None, true),
        (None, Some(1), false),
        (None, Some(5), false),
        (None, Some(5), true),
        (Some(3), Some(5), false),
        (Some(3), Some(5), true),
    ];
    for (skip, limit, use_map) in cases {
        for seed in 1..=10u64 {
            let (optimized, rounds) = fuzz(seed * 7919, skip, limit, use_map);
            assert!(optimized > 0, "no event was optimized in {} rounds", rounds);
        }
    }
}
