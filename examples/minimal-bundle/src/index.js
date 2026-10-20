import { calculateActionFunction } from 'event-reduce-js';

/**
 * Query: SELECT * FROM users WHERE age > 18 ORDER BY age, id LIMIT 10
 */
const queryParams = {
    primaryKey: 'id',
    sortFields: ['age', 'id'],
    limit: 10,
    queryMatcher: doc => doc.age > 18,
    sortComparator: (a, b) => (a.age - b.age || (a.id < b.id ? -1 : 1)) < 0 ? -1 : 1
};
const previousResults = [{ id: 'a', age: 20 }, { id: 'b', age: 30 }];
const changeEvent = { operation: 'INSERT', id: 'c', doc: { id: 'c', age: 25 }, previous: null };

/**
 * Loads the packed BDD (a Uint8Array) and runs a single resolution over it.
 * Returns the action function directly so no action names end up in the bundle.
 */
const action = calculateActionFunction({ queryParams, changeEvent, previousResults });
action({ queryParams, changeEvent, previousResults });

console.log(previousResults);
