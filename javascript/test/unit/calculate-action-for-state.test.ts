import * as assert from 'assert';

import {
    calculateActionForState
} from '../../src/logic-generator/calculate-action-for-state';
import {
    STATE_SET_LENGTH
} from '../../src/logic-generator/binary-state';
import {
    getStateSet
} from '../../src/states';
import {
    orderedActionList
} from '../../src/actions';
import {
    ActionName,
    StateSet,
    StateResolveFunctionInput,
    ChangeEvent
} from '../../src/types';
import {
    getExampleStateResolveFunctionInput
} from '../helper/input';
import { Human, MongoQuery } from '../../src/logic-generator/types';
import {
    getQueryParamsByMongoQuery,
    getMinimongoCollection,
    applyChangeEvent,
    minimongoFind
} from '../../src/logic-generator/minimongo-helper';
import {
    getQueryVariations,
    findAllQuery,
    DEFAULT_EXAMPLE_QUERY
} from '../../src/logic-generator/queries';
import {
    insertFiveThenChangeAgeOfOne,
    insertFiveSorted
} from '../../src/logic-generator/test-procedures';
import { lastOfArray } from '../../src/util';
import { randomHuman } from '../../src/logic-generator/data-generator';
import { clone } from 'async-test-util';
describe('calculate-action-for-state.test.ts', () => {
    it('should not throw and return an action', async () => {
        const input = getExampleStateResolveFunctionInput();
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet,
            [
                getQueryVariations()[0]
            ]
        );
        assert.ok(orderedActionList.includes(action));
    });
    it('should have the given action insertFirst', async () => {
        const input = getExampleStateResolveFunctionInput();
        const stateSet = getStateSet(input); // 1000100010010101
        const action: ActionName = await calculateActionForState(
            stateSet,
            [
                DEFAULT_EXAMPLE_QUERY
            ]
        );
        assert.equal(action, 'insertFirst');
    });
    it('should have action "unknownAction" on impossible state', async () => {
        const stateSet: StateSet = new Array(STATE_SET_LENGTH)
            .fill('1')
            .join(''); // '111111111...'
        const action: ActionName = await calculateActionForState(
            stateSet
        );
        assert.equal(action, 'unknownAction');
    });
    it('should have "removeExistingAndInsertAtSortPosition"', async () => {
        const query = Object.assign({},
            findAllQuery, {
            sort: ['age'],
            limit: 5
        });
        const events = insertFiveThenChangeAgeOfOne();
        const previousResults: Human[] = events
            .filter(ev => ev.operation === 'INSERT')
            .map(ev => ev.doc as Human)
            .slice(0, query.limit);
        const updateChangeEvent = events.find(ev => ev.operation === 'UPDATE') as any;
        const input: StateResolveFunctionInput<Human> = {
            previousResults,
            changeEvent: updateChangeEvent,
            queryParams: getQueryParamsByMongoQuery(query)
        };
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet,
            [query],
            [events]
        );
        assert.strictEqual(
            'removeExistingAndInsertAtSortPosition',
            action
        );
    });
    it('should have "removeExisting"', async () => {
        const query = Object.assign({},
            findAllQuery, {
            sort: ['age'],
            limit: 5
        });
        const events = insertFiveThenChangeAgeOfOne()
            .filter(cE => cE.operation === 'INSERT');
        const previousResults: Human[] = events
            .filter(ev => ev.operation === 'INSERT')
            .map(ev => ev.doc as Human)
            .slice(0, query.limit);

        const removeHuman = previousResults[1];
        const changeEvent: ChangeEvent<Human> = {
            operation: 'DELETE',
            doc: null,
            id: removeHuman._id,
            previous: removeHuman
        };
        events.push(changeEvent);
        const input: StateResolveFunctionInput<Human> = {
            previousResults,
            changeEvent,
            queryParams: getQueryParamsByMongoQuery(query)
        };
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet,
            [query],
            [events]
        );
        assert.strictEqual(
            'removeExisting',
            action
        );
    });
    it('should have "doNothing"', async () => {
        const query = Object.assign({},
            findAllQuery, {
            sort: ['age'],
            limit: 5
        });
        const events = insertFiveThenChangeAgeOfOne();
        const previousResults: Human[] = events
            .filter(ev => ev.operation === 'INSERT')
            .map(ev => ev.doc as Human)
            .slice(0, query.limit);

        const insertHuman = randomHuman();
        insertHuman.age = 10000; // very hight so it appears not in the results
        const input: StateResolveFunctionInput<Human> = {
            previousResults,
            changeEvent: {
                operation: 'INSERT',
                doc: insertHuman,
                id: insertHuman._id,
                previous: null
            },
            queryParams: getQueryParamsByMongoQuery(query)
        };
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet,
            [query],
            [events]
        );
        assert.strictEqual(
            'doNothing',
            action
        );
    });
    it('should have "replaceExisting"', async () => {
        const query = Object.assign({},
            findAllQuery, {
            sort: ['age'],
            limit: 5
        });
        const events = insertFiveThenChangeAgeOfOne()
            .filter(cE => cE.operation === 'INSERT'); // remove update event

        const previousResults: Human[] = events
            .filter(ev => ev.operation === 'INSERT')
            .map(ev => ev.doc as Human)
            .slice(0, query.limit);

        const lastHuman = lastOfArray(previousResults);
        const updateHuman = clone(lastHuman);
        updateHuman.name = 'foobar';
        const addChangeEvent: ChangeEvent<Human> = {
            operation: 'UPDATE',
            doc: updateHuman,
            id: updateHuman._id,
            previous: lastHuman
        };
        events.push(addChangeEvent);
        const input: StateResolveFunctionInput<Human> = {
            previousResults,
            changeEvent: addChangeEvent,
            queryParams: getQueryParamsByMongoQuery(query)
        };
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet,
            [query],
            [events]
        );
        assert.strictEqual(
            'replaceExisting',
            action
        );
    });
    it('should have "removeLastItem"', async () => {
        const col = getMinimongoCollection();
        const query: MongoQuery = {
            selector: {},
            skip: 3,
            limit: 3,
            sort: ['age']
        };
        const events = insertFiveSorted();
        await Promise.all(
            events.map(cE => applyChangeEvent(
                col, cE
            ))
        );
        const previousResults = await minimongoFind(
            col,
            query
        );
        const deleteMe: Human = clone(lastOfArray(events).doc);
        const deleteEvent: ChangeEvent<Human> = {
            operation: 'DELETE',
            doc: null,
            id: deleteMe._id,
            previous: deleteMe
        };

        const input: StateResolveFunctionInput<Human> = {
            previousResults,
            changeEvent: deleteEvent,
            queryParams: getQueryParamsByMongoQuery(query)
        };
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet,
            [query],
            [events.concat([deleteEvent])]
        );
        assert.strictEqual(
            'removeLastItem',
            action
        );
        process.exit();
    });
});
