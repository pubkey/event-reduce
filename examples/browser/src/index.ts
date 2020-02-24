import {
    setQuery,
    setResults,
    $test100EventsButton,
    appendToLog,
    $test100EventsEventReduceButton
} from './dom';

import {
    MiniMongoImplementation, getQueryParamsByMongoQuery
} from './minimongo';
import {
    randomHumans,
    getInitialData,
    getRandomChangeEvents
} from './data-generator';
import { Human, IdToDocumentMap } from './types';
import { idToDocMapFromList } from './util';
import { ChangeEvent, calculateActionName, StateResolveFunctionInput, runAction } from 'event-reduce-js';
import { performanceNow } from 'async-test-util';


async function run() {
    const implementation = new MiniMongoImplementation();
    await implementation.init();

    // add initial data
    const initialData: ChangeEvent<Human>[] = getInitialData(100);
    await Promise.all(initialData.map(cE => implementation.handleEvent(cE)));


    // init inintial query
    const query = implementation.getExampleQueries()[0];
    setQuery(query);
    let currentResults: Human[] = await implementation.getRawResults(query);
    let currentDocMap: IdToDocumentMap = idToDocMapFromList(currentResults);
    setResults(currentResults);


    // without event-reduce
    $test100EventsButton.onclick = async () => {
        const prevData = await implementation.getAll();
        const events = await getRandomChangeEvents(
            prevData,
            100
        );

        let totalWriteTime = 0;
        const timeStart = performanceNow();
        for (const changeEvent of events) {
            const writeTime = await implementation.handleEvent(changeEvent);
            totalWriteTime = totalWriteTime + writeTime;
            currentResults = await implementation.getRawResults(query);
            setResults(currentResults);
        }
        currentDocMap = idToDocMapFromList(currentResults);

        const timeEnd = performanceNow();
        const totalTimeInMs = timeEnd - timeStart;
        const queryTime = totalTimeInMs - totalWriteTime;

        appendToLog('running 100 events without event reduce', {
            totalTimeInMs,
            totalWriteTime,
            queryTime
        });
    };

    // with event-reduce
    $test100EventsEventReduceButton.onclick = async () => {
        const prevData = await implementation.getAll();
        const events = await getRandomChangeEvents(
            prevData,
            100
        );
        const queryParams = getQueryParamsByMongoQuery(query);
        let optimizedEventsCount = 0;
        let totalWriteTime = 0;
        const timeStart = performanceNow();
        for (const changeEvent of events) {

            const writeTime = await implementation.handleEvent(changeEvent);
            totalWriteTime = totalWriteTime + writeTime;

            const input: StateResolveFunctionInput<Human> = {
                changeEvent,
                queryParams,
                previousResults: currentResults,
                keyDocumentMap: currentDocMap
            };
            const action = calculateActionName(input);
            if (action === 'runFullQueryAgain') {
                currentResults = await implementation.getRawResults(query);
                currentDocMap = idToDocMapFromList(currentResults);
                
                // console.dir(JSON.parse(JSON.stringify(input)));
            } else {
                optimizedEventsCount++;
                runAction(
                    action,
                    queryParams,
                    changeEvent,
                    currentResults,
                    currentDocMap
                );
            }
            setResults(currentResults);
        }


        const timeEnd = performanceNow();
        const totalTimeInMs = timeEnd - timeStart;

        const queryTime = totalTimeInMs - totalWriteTime;
        appendToLog('running 100 events with event-reduce', {
            totalTimeInMs,
            totalWriteTime,
            optimizedEventsCount,
            queryTime
        });
    };
}

run();
