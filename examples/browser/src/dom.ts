
import AsyncTestUtil from 'async-test-util';

import {
    Human,
    MongoQuery,
    DatabaseImplementation,
    Query
} from './types';
const prettyHtml = require('json-pretty-html').default;

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
    addTdToTr(headTr, 'Id:', true);
    addTdToTr(headTr, 'Name:', true);
    addTdToTr(headTr, 'Gender:', true);
    addTdToTr(headTr, 'Age:', true);
    addTdToTr(headTr, 'delete:', true);
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
    const logDiv = document.getElementById('log') as any;
    const newLog = document.createElement('div');
    newLog.classList.add('single-log');

    const titleDiv = document.createElement('h4');
    titleDiv.innerHTML = title;
    newLog.appendChild(titleDiv);

    if (data) {
        const contentDiv = document.createElement('div');
        contentDiv.classList.add('content');
        const jsonString = prettyHtml(data);
        contentDiv.innerHTML = jsonString;
        newLog.appendChild(contentDiv);
    }

    logDiv.prepend(newLog);
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
