import { calculateActionName, runAction } from 'event-reduce-js';

/**
 * Query: SELECT * FROM users WHERE age > 18 ORDER BY age, id LIMIT 10
 */
const queryParams = {
    primaryKey: 'id',
    sortFields: ['age', 'id'],
    skip: 0,
    limit: 10,
    queryMatcher: doc => doc.age > 18,
    sortComparator: (a, b) => {
        if (a.age !== b.age) return a.age < b.age ? -1 : 1;
        return a.id < b.id ? -1 : 1;
    }
};

// a tiny in-memory "database"
const db = new Map();
function runFullQuery() {
    return Array.from(db.values())
        .filter(queryParams.queryMatcher)
        .sort(queryParams.sortComparator)
        .slice(queryParams.skip, queryParams.skip + queryParams.limit);
}

let idCounter = 0;
const randomAge = () => Math.floor(Math.random() * 60);
const ids = () => Array.from(db.keys());
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// writes to the database and returns the change event
function randomWrite() {
    const existing = ids();
    const r = Math.random();
    if (existing.length === 0 || r < 0.5) {
        const doc = { id: 'u' + (idCounter++).toString().padStart(5, '0'), age: randomAge() };
        db.set(doc.id, doc);
        return { operation: 'INSERT', id: doc.id, doc, previous: null };
    }
    const id = pick(existing);
    const previous = db.get(id);
    if (r < 0.8) {
        const doc = { ...previous, age: randomAge() };
        db.set(id, doc);
        return { operation: 'UPDATE', id, doc, previous };
    }
    db.delete(id);
    return { operation: 'DELETE', id, doc: null, previous };
}

const stats = { optimized: 0, fullQuery: 0, errors: 0 };
let results = runFullQuery();

for (let i = 0; i < 2000; i++) {
    const changeEvent = randomWrite();
    const action = calculateActionName({ queryParams, changeEvent, previousResults: results });
    if (action === 'runFullQueryAgain') {
        stats.fullQuery++;
        results = runFullQuery();
    } else {
        stats.optimized++;
        results = runAction(action, queryParams, changeEvent, results.slice());
    }
    // verify that event-reduce produced the same result as the database
    if (JSON.stringify(results) !== JSON.stringify(runFullQuery())) {
        stats.errors++;
        results = runFullQuery();
    }
}

const total = stats.optimized + stats.fullQuery;
const summary = 'event-reduce demo: ' + total + ' events, ' +
    stats.optimized + ' optimized (' + (100 * stats.optimized / total).toFixed(1) + '%), ' +
    stats.fullQuery + ' needed full query, ' + stats.errors + ' mismatches';
console.log(summary);
console.log('final results:', results);

if (typeof document !== 'undefined') {
    const pre = document.createElement('pre');
    pre.textContent = summary + '\n\n' + JSON.stringify(results, null, 2);
    document.body.appendChild(pre);
}
