import { StateSet, ChangeEvent } from '../types';
import { testResults } from './test-results';
import { getQueryVariations } from './queries';
import { getTestProcedures } from './test-procedures';
import { MongoQuery, Human } from './types';

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
    const sets: Set<StateSet> = new Set();

    // a Map that always is correct but also tracks its requests
    const trackingMap = new Map();
    trackingMap.get = (stateSet: StateSet) => {
        sets.add(stateSet);
        return 'runFullQueryAgain';
    };

    for (const prod of prods) {
        const valid = await testResults(
            queries,
            trackingMap,
            prod
        );
        if (!valid.correct) {
            throw new Error('this should never happen');
        }
    }
    return sets;
}
