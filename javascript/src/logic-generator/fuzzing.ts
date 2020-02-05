import { StateSetToActionMap } from '../types';
import { randomQuery } from './queries';
import { MongoQuery } from './types';
import { getRandomChangeEvents } from './data-generator';
import { testResults } from './test-results';

export async function fuzzing(
    stateToActionMap: StateSetToActionMap,
    queriesAmount: number = 30,
    eventsAmount: number = 100
) {
    const queries: MongoQuery[] = new Array(queriesAmount)
        .fill(0)
        .map(() => randomQuery());
    // console.dir(queries);
    const events = await getRandomChangeEvents(eventsAmount);

    const result = await testResults(
        queries,
        stateToActionMap,
        events,
        false,
        true
    );

    return result;
}
