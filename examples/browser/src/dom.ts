import {
    Human,
    MongoQuery,
    DatabaseImplementation,
    Query
} from './types';

const $results = document.getElementById('results');
export const $queryTextArea = document.getElementById('queryTextArea');
export const $invalidQuery = document.getElementById('invalid-query');
export const $queryExampleButtons = document.getElementById('query-example-buttons');
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

export function setExampleQueries(
    queries: Query[], onChange: (query: Query) => void
) {
    queries.forEach((query, index) => {
        const newButton = document.createElement('div');
        newButton.classList.add('button');
        newButton.classList.add('example-query-button');

        const indexPlusOne = index + 1;
        newButton.innerHTML = 'Query #' + indexPlusOne;
        newButton.onclick = () => {
            setQuery(query);
            onChange(query);
        };
        newButton.dataset.queryIndex = index.toString();

        $queryExampleButtons.appendChild(newButton);
    });
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
