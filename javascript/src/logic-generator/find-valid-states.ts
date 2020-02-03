import { StateSet, ChangeEvent } from '../types';
import { testResults } from './test-results';
import { getQueryVariations } from './queries';
import { getTestProcedures } from './test-procedures';
import { MongoQuery, Human } from './types';
import { mergeSets } from '../util';

/**
 * returns a list of all state-sets
 * that can somehow be reached with
 * the testing-queries and event-procedures
 */
export async function findValidStates(
    queries: MongoQuery[] = getQueryVariations(),
    prods?: ChangeEvent<Human>[][]
): Promise<Set<StateSet>> {
    if (!prods) {
        prods = await getTestProcedures();
    }
    const sets: Set<StateSet>[] = [];
    for (const prod of prods) {
        const valid = await testResults(
            queries,
            new Map(),
            prod
        );
        sets.push(valid.stateSets);
    }
    return mergeSets(sets);
}
