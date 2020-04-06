import {
    Human,
    MongoQuery,
    DatabaseImplementation,
    Query
} from './types';

const $results = document.getElementById('results');
const $queryTextArea = document.getElementById('queryTextArea');
export const $test100EventsButton = document.getElementById('test100EventsButton');
export const $test100EventsEventReduceButton = document.getElementById('test100EventsEventReduceButton');

export const $techSelectionSelect: HTMLSelectElement = document.getElementById('techSelectionSelect') as HTMLSelectElement;

export function setResults(docs: Human[]) {

    // clear old
    $results.innerHTML = '';

    function addTdToTr(tr: any, text: string | any, head: boolean = false): any {
        let td = document.createElement('td');
        if (head) td = document.createElement('th');

        if (typeof text === 'string' || typeof text === 'number') {
            td.innerHTML = text + '';
        } else {
            td.appendChild(text);
        }
        tr.appendChild(td);
        return td;
    }

    // add headers
    const headTr = document.createElement('tr');
    addTdToTr(headTr, '_id:', true);
    addTdToTr(headTr, 'name:', true);
    addTdToTr(headTr, 'gender:', true);
    addTdToTr(headTr, 'age:', true);
    $results.appendChild(headTr);

    docs.forEach(doc => {
        const tr = document.createElement('tr');
        addTdToTr(tr, doc._id);
        addTdToTr(tr, doc.name);


        addTdToTr(tr, doc.gender);

        const ageDom = addTdToTr(tr, doc.age.toString());
        ageDom.classList.add('pointer');
        /**
        ageDom.onclick = async function() {
            console.log('change age');
            await changeAgeById(db, doc._id);
        };*/



        /*
        const removeButton = document.createElement('button');
        removeButton.innerHTML = 'X';
        removeButton.onclick = async function() {
            console.log('delete ' + doc._id);
            await removeUserById(db, doc._id);
        };
        addTdToTr(tr, removeButton);*/

        $results.appendChild(tr);
    });
}

export function getCurrentQuery(): Query {
    const value: string = ($queryTextArea as any).value;
    const query = JSON.parse(value);
    return query;
}

export function setQuery(query: Query) {
    ($queryTextArea as any).value = JSON.stringify(query, null, 4);
}

export function appendToLog(title: string, data?: any) {
    const logPlaceholder = document.getElementById('logs-placeholder');
    if (logPlaceholder) {
        logPlaceholder.remove();
    }

    const logDiv = document.getElementById('log') as any;
    const newLog = document.createElement('div');
    newLog.classList.add('single-log');

    const titleDiv = document.createElement('h4');
    titleDiv.innerHTML = title;
    newLog.appendChild(titleDiv);

    const dateDiv = document.createElement('h5');
    dateDiv.innerHTML = new Date().toLocaleTimeString();
    newLog.appendChild(dateDiv);


    if (data) {
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content');

        Object.entries(data).forEach(([key, value], index) => {
            if (index > 0) {
                const hrDiv = document.createElement('hr');
                contentDiv.appendChild(hrDiv);
            }

            const entryDiv = document.createElement('div');
            entryDiv.classList.add('list-item');

            const keyDiv = document.createElement('div');
            keyDiv.classList.add('key');
            keyDiv.innerHTML = key;
            entryDiv.appendChild(keyDiv);

            const valueDiv = document.createElement('div');
            valueDiv.classList.add('value');
            valueDiv.innerHTML = value.toString();
            entryDiv.appendChild(valueDiv);

            contentDiv.appendChild(entryDiv);
        });
        newLog.appendChild(contentDiv);
    }

    logDiv.prepend(newLog);
}

const $loadingState = document.getElementById('loading-state');

export function setLoadingState(label: string = 'Waiting for action trigger') {
    $loadingState.innerHTML = label;
    if (label.toLowerCase().startsWith('run')) {
        const iconDiv = document.createElement('div');
        iconDiv.classList.add('loading-icon');
        $loadingState.appendChild(iconDiv);
    }
}

export function setButtonsDisableState(to: boolean) {
    const buttons = document.getElementsByClassName('button');
    for (let i = 0; i < buttons.length; i++) {
        if (to) {
            buttons[i].classList.add('disabled');
        } else {
            buttons[i].classList.remove('disabled');
        }
    }
}

export function initDom<QueryType>(implementation: DatabaseImplementation<QueryType>) {
    const submitQueryButton = document.getElementById('submitQueryButton');
    (submitQueryButton as any).onclick = async () => {
        console.log('submit query');
        // const queryData: QueryType = getCurrentQuery();
        // console.dir(queryData);
        /*        const query = new Query(db, queryData);
        
                const startTime = AsyncTestUtil.performanceNow();
                const result = await query.execOverDatabase();
                const endTime = AsyncTestUtil.performanceNow();
                const duration: number = Math.floor(endTime - startTime);
                console.log('took ' + Math.floor(duration) + 'ms');
                appendToLog('query took ' + duration + 'ms');
                setResults(db, result);*/
    };
    /*
        const insertUserButton = document.getElementById('insertUserButton');
        (insertUserButton as any).onclick = async () => {
            console.log('insert user');
            await insertRandomUser(db, STATE.LAST_INSERT_ID);
            STATE.LAST_INSERT_ID++;
        };
    
    
        const handleLastDeleteEventButton = document.getElementById('handleLastDeleteEventButton');
        (handleLastDeleteEventButton as any).onclick = async () => {
            const queryData: QueryData = getCurrentQuery();
            console.dir(queryData);
            const query = new Query(db, queryData);
    
            const startTime = AsyncTestUtil.performanceNow();
            const result = query.handleLastDeleteEvent(CURRENT_RESULTS);
            const endTime = AsyncTestUtil.performanceNow();
            const duration: number = Math.floor(endTime - startTime);
            console.log('took ' + Math.floor(duration) + 'ms');
            appendToLog('query took ' + duration + 'ms');
            setResults(db, result);
        };
    
        const handleLastInsertEventButton = document.getElementById('handleLastInsertEventButton');
        (handleLastInsertEventButton as any).onclick = async () => {
            const queryData: QueryData = getCurrentQuery();
            console.dir(queryData);
            const query = new Query(db, queryData);
    
            const startTime = AsyncTestUtil.performanceNow();
            const result = query.handleLastInsertEvent(CURRENT_RESULTS);
            const endTime = AsyncTestUtil.performanceNow();
            const duration: number = Math.floor(endTime - startTime);
            console.log('took ' + Math.floor(duration) + 'ms');
            appendToLog('query took ' + duration + 'ms');
            setResults(db, result);
        };
    
        const handleLastUpdateEventButton = document.getElementById('handleLastUpdateEventButton');
        (handleLastUpdateEventButton as any).onclick = async () => {
            const queryData: QueryData = getCurrentQuery();
            console.dir(queryData);
            const query = new Query(db, queryData);
    
            const startTime = AsyncTestUtil.performanceNow();
            const result = query.handleLastUpdateEvent(CURRENT_RESULTS);
            const endTime = AsyncTestUtil.performanceNow();
            const duration: number = Math.floor(endTime - startTime);
            console.log('took ' + Math.floor(duration) + 'ms');
            appendToLog('query took ' + duration + 'ms');
            setResults(db, result);
        };
    
        const queryButton1 = document.getElementById('query1Button');
        (queryButton1 as any).onclick = async () => {
            setQuery({
                selector: {},
                sort: ['name']
            });
        };
    
        const queryButton2 = document.getElementById('query2Button');
        (queryButton2 as any).onclick = async () => {
            setQuery({
                selector: {
                    loggedIn: {
                        $eq: true
                    }
                },
                sort: ['name']
            });
        };
    
        const queryButton3 = document.getElementById('query3Button');
        (queryButton3 as any).onclick = async () => {
            setQuery({
                selector: {
                    loggedIn: {
                        $eq: true
                    }
                },
                sort: ['name'],
                skip: 10,
                limit: 10
            });
        };*/
}
