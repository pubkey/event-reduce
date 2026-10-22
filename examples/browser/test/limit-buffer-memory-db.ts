import type { ChangeEvent, QueryParams } from 'event-reduce-js';
import type { Human } from '../src/types';

/**
 * A small in-memory "database" with a seeded random event generator,
 * used by the limit buffer benchmark.
 * It runs in Node.js, so it does not use the browser databases of the demo.
 */

/**
 * Seeded random number generator (mulberry32),
 * so that every run produces the same events.
 */
export function seededRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export type TestQuery = {
    sortDirection: 'asc' | 'desc';
    skip?: number;
    limit?: number;
};

/**
 * The query is always: gender === 'f', sorted by age, then by _id.
 * Age has only 100 different values, so many rows have the same age
 * and the _id decides their order.
 */
export function getTestQueryParams(query: TestQuery): QueryParams<Human> {
    const direction = query.sortDirection === 'asc' ? 1 : -1;
    return {
        primaryKey: '_id',
        sortFields: ['age', '_id'],
        skip: query.skip,
        limit: query.limit,
        queryMatcher: (doc: Human) => doc.gender === 'f',
        sortComparator: (a: Human, b: Human) => {
            if (a.age !== b.age) {
                return a.age < b.age ? -direction as 1 | -1 : direction as 1 | -1;
            }
            return a._id < b._id ? -direction as 1 | -1 : direction as 1 | -1;
        }
    };
}

export class MemoryTable {
    readonly docs = new Map<string, Human>();
    // to pick a random row in O(1)
    private readonly ids: string[] = [];
    private readonly indexOfId = new Map<string, number>();

    applyChangeEvent(changeEvent: ChangeEvent<Human>) {
        const id = changeEvent.id;
        if (changeEvent.operation === 'DELETE') {
            this.docs.delete(id);
            const index = this.indexOfId.get(id);
            const lastId = this.ids.pop();
            if (lastId !== id) {
                this.ids[index] = lastId;
                this.indexOfId.set(lastId, index);
            }
            this.indexOfId.delete(id);
        } else {
            if (!this.docs.has(id)) {
                this.indexOfId.set(id, this.ids.length);
                this.ids.push(id);
            }
            this.docs.set(id, changeEvent.doc);
        }
    }

    randomDoc(random: () => number): Human {
        return this.docs.get(this.ids[Math.floor(random() * this.ids.length)]);
    }

    /**
     * Full query: filter, sort, skip, limit.
     */
    query(queryParams: QueryParams<Human>, limit = queryParams.limit): Human[] {
        const matching: Human[] = [];
        for (const doc of this.docs.values()) {
            if (queryParams.queryMatcher(doc)) {
                matching.push(doc);
            }
        }
        matching.sort(queryParams.sortComparator);
        const skip = queryParams.skip ? queryParams.skip : 0;
        return limit === undefined ? matching.slice(skip) : matching.slice(skip, skip + limit);
    }
}

export class EventGenerator {
    readonly random: () => number;
    private idCounter = 0;

    constructor(seed: number) {
        this.random = seededRandom(seed);
    }

    int(min: number, max: number): number {
        return min + Math.floor(this.random() * (max - min + 1));
    }

    randomHuman(): Human {
        this.idCounter++;
        return {
            _id: 'id-' + this.int(0, 1e9).toString(36) + '-' + this.idCounter,
            name: 'name-' + this.int(0, 1000),
            gender: this.random() < 0.5 ? 'f' : 'm',
            age: this.int(1, 100)
        };
    }

    /**
     * Inserts, updates and deletes, with weights.
     * Updates change one of: name (no effect on the query),
     * gender (starts or stops matching), age (moves the row in the sort order).
     */
    randomChangeEvent(
        table: MemoryTable,
        weights: { insert: number; update: number; delete: number; }
    ): ChangeEvent<Human> {
        const total = weights.insert + weights.update + weights.delete;
        let r = this.random() * total;
        if (table.docs.size === 0 || r < weights.insert) {
            const doc = this.randomHuman();
            return { operation: 'INSERT', id: doc._id, doc, previous: null };
        }
        r = r - weights.insert;
        const previous = table.randomDoc(this.random);
        if (r < weights.update) {
            const doc: Human = { ...previous };
            const field = this.int(1, 3);
            if (field === 1) {
                doc.name = 'name-' + this.int(0, 1000);
            } else if (field === 2) {
                doc.gender = doc.gender === 'f' ? 'm' : 'f';
            } else {
                doc.age = this.int(1, 100);
            }
            return { operation: 'UPDATE', id: doc._id, doc, previous };
        }
        return { operation: 'DELETE', id: previous._id, doc: null, previous };
    }
}

export function idsOf(docs: Human[]): string {
    return docs.map(d => d._id).join(',');
}
