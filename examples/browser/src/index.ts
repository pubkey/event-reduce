import {
    setQuery,
    setResults,
    $test100EventsButton,
    $test100EventsEventReduceButton,
    $techSelectionSelect,
    setButtonsDisableState,
    setLoadingState,
    setExampleQueries,
    $queryTextArea,
    $invalidQuery,
    buttonsDisabled,
    $testLimitBufferButton,
    $limitBufferSizeSelect,
    setLimitBufferMessage,
    setLimitBufferResults,
    LimitBufferComparisonRow
} from './dom';

import {
    getInitialData,
    getRandomChangeEvents
} from './data-generator';
import { Human, IdToDocumentMap, DatabaseImplementation, Query, MongoQuery } from './types';
import { idToDocMapFromList, removeOptions, getParameterByName, getImplementations } from './util';
import {
    ChangeEvent,
    calculateActionName,
    StateResolveFunctionInput,
    runAction,
    applyChangeEventToLimitBuffer,
    createLimitBuffer,
    getLimitBufferQueryLimit,
    getLimitBufferResults,
    resetLimitBuffer
} from 'event-reduce-js';
import { performanceNow } from 'async-test-util';

import '../style.less';
import { appendToLog } from './logs';

/**
 * Compares two results of the same query.
 * Rows that the sort comparator sees as equal may be in any order,
 * because the databases do not all break ties the same way.
 */
function isSameResult(a: Human[], b: Human[], sortComparator: (a: Human, b: Human) => number): boolean {
    if (a.length !== b.length) {
        return false;
    }
    return a.every((doc, i) => doc._id === b[i]._id || sortComparator(doc, b[i]) === 0);
}

async function run() {
    const implementations = getImplementations();

    // init selects
    implementations.forEach(imp => {
        const name = imp.getName();
        imp.getStorageOptions().forEach(option => {
            const optionDiv = document.createElement('option');
            optionDiv.text = name + ': ' + option;
            optionDiv.value = name + ':' + option;
            $techSelectionSelect.add(optionDiv);
        });
    });
    const techParam = getParameterByName('tech');
    if (techParam) {
        $techSelectionSelect.value = techParam;
    }
    $techSelectionSelect.onchange = () => {
        console.log('selectred');
        const newValue = $techSelectionSelect.value;
        const newUrl = location.origin + location.pathname + '?tech=' + newValue;
        window.location.href = newUrl;
    };


    const techValue = $techSelectionSelect.value;
    console.log('techValue: ' + techValue);
    const split = techValue.split(':');
    const implementation: DatabaseImplementation = implementations.find(imp => imp.getName() === split[0]);
    const storage = split[1];

    await implementation.init(storage);

    // add initial data
    const initialData: ChangeEvent<Human>[] = getInitialData(100);
    await Promise.all(initialData.map(cE => implementation.handleEvent(cE)));


    // init inintial query
    let query = implementation.getExampleQueries()[0];
    setQuery(query);
    let currentResults: Human[] = await implementation.getRawResults(query);
    let currentDocMap: IdToDocumentMap = idToDocMapFromList(currentResults);
    setResults(currentResults);

    // update results on query change
    $queryTextArea.onkeyup = async () => {
        console.log('$queryTextArea.onkeyup()');
        const newValue = ($queryTextArea as any).value;
        try {
            query = JSON.parse(newValue);
            currentResults = await implementation.getRawResults(query);
            setResults(currentResults);
            $invalidQuery.style.display = 'none';
        } catch (err) {
            console.dir(newValue);
            console.dir(err);
            $invalidQuery.style.display = 'block';
        }
    };

    // add query example buttons
    setExampleQueries(
        implementation.getExampleQueries(),
        async (clickedQuery: Query) => {
            $invalidQuery.style.display = 'none';
            currentResults = await implementation.getRawResults(clickedQuery);
            // only use the query for the actions when the database could run it
            query = clickedQuery;
            currentDocMap = idToDocMapFromList(currentResults);
            setResults(currentResults);
        }
    );

    // without event-reduce
    $test100EventsButton.onclick = async () => {
        if (buttonsDisabled()) return;

        setButtonsDisableState(true);
        setLoadingState('Run without EventReduce..');

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

        setButtonsDisableState(false);
        setLoadingState();
    };

    // with event-reduce
    $test100EventsEventReduceButton.onclick = async () => {
        if (buttonsDisabled()) return;

        setButtonsDisableState(true);
        setLoadingState('Run with EventReduce..');

        const prevData = await implementation.getAll();
        const events = await getRandomChangeEvents(
            prevData,
            100
        );
        const queryParams = implementation.getQueryParams(query);
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
                /**
                 * when EventReduce could not optimize the input,
                 * we get the actionName 'runFullQueryAgain'
                 * and run the query over the database again
                 */
                currentResults = await implementation.getRawResults(query);
                currentDocMap = idToDocMapFromList(currentResults);
            } else {
                optimizedEventsCount++;
                /**
                 * EventReduce was able to optimize the event
                 * and we can run the correct action function
                 * to calculate the new results
                 */
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

        setButtonsDisableState(false);
        setLoadingState();
    };

    // compare full query, EventReduce and EventReduce with a limit buffer
    $testLimitBufferButton.onclick = async () => {
        if (buttonsDisabled()) return;

        const mongoQuery = query as MongoQuery;
        if (!mongoQuery.limit) {
            setLimitBufferMessage('The current query has no limit. Select a query with a limit, like Query #1.');
            return;
        }
        setLimitBufferMessage();
        setButtonsDisableState(true);
        setLoadingState('Run limit buffer comparison..');
        try {
            await runLimitBufferComparison(mongoQuery);
        } catch (err) {
            console.error(err);
            setLimitBufferMessage('Error: ' + err.message);
        }
        setButtonsDisableState(false);
        setLoadingState();
    };

    async function runLimitBufferComparison(mongoQuery: MongoQuery) {

        const bufferSize = parseInt($limitBufferSizeSelect.value, 10);
        const queryParams = implementation.getQueryParams(query);
        const bufferQuery: MongoQuery = { ...mongoQuery, limit: mongoQuery.limit + bufferSize };
        const eventsAmount = 100;
        const events = await getRandomChangeEvents(await implementation.getAll(), eventsAmount);

        const fullQueryRow: LimitBufferComparisonRow = { name: 'Full query after each event', fullQueries: 0, timeInMs: 0, wrongResults: 0 };
        const eventReduceRow: LimitBufferComparisonRow = { name: 'EventReduce', fullQueries: 0, timeInMs: 0, wrongResults: 0 };
        const limitBufferRow: LimitBufferComparisonRow = {
            name: 'EventReduce + limit buffer (' + bufferSize + ')',
            fullQueries: 0,
            timeInMs: 0,
            wrongResults: 0
        };

        // the initial queries are not measured
        let eventReduceResults = await implementation.getRawResults(query);
        let eventReduceDocMap = idToDocMapFromList(eventReduceResults);
        const limitBuffer = createLimitBuffer(queryParams, bufferSize, await implementation.getRawResults(bufferQuery));

        let timeStart: number;
        for (const changeEvent of events) {
            await implementation.handleEvent(changeEvent);

            // 1. full query
            timeStart = performanceNow();
            const fullQueryResults = await implementation.getRawResults(query);
            fullQueryRow.timeInMs += performanceNow() - timeStart;
            fullQueryRow.fullQueries++;

            // 2. EventReduce
            timeStart = performanceNow();
            const action = calculateActionName({
                changeEvent,
                queryParams,
                previousResults: eventReduceResults,
                keyDocumentMap: eventReduceDocMap
            });
            if (action === 'runFullQueryAgain') {
                eventReduceRow.fullQueries++;
                eventReduceResults = await implementation.getRawResults(query);
                eventReduceDocMap = idToDocMapFromList(eventReduceResults);
            } else {
                runAction(action, queryParams, changeEvent, eventReduceResults, eventReduceDocMap);
            }
            eventReduceRow.timeInMs += performanceNow() - timeStart;

            // 3. EventReduce + limit buffer
            timeStart = performanceNow();
            if (applyChangeEventToLimitBuffer(limitBuffer, changeEvent) === 'runFullQueryAgain') {
                limitBufferRow.fullQueries++;
                bufferQuery.limit = getLimitBufferQueryLimit(limitBuffer);
                resetLimitBuffer(limitBuffer, await implementation.getRawResults(bufferQuery));
            }
            const limitBufferResults = getLimitBufferResults(limitBuffer);
            limitBufferRow.timeInMs += performanceNow() - timeStart;

            if (!isSameResult(eventReduceResults, fullQueryResults, queryParams.sortComparator)) {
                eventReduceRow.wrongResults++;
            }
            if (!isSameResult(limitBufferResults, fullQueryResults, queryParams.sortComparator)) {
                limitBufferRow.wrongResults++;
            }

            currentResults = fullQueryResults;
            setResults(limitBufferResults);
        }
        currentDocMap = idToDocMapFromList(currentResults);

        setLimitBufferResults(eventsAmount, [fullQueryRow, eventReduceRow, limitBufferRow]);
    }

    setLoadingState();
}

run();
