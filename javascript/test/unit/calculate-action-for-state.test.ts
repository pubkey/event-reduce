import * as assert from 'assert';

import {
    calculateActionForState
} from '../../src/logic-generator/calculate-action-for-state';
import {
    STATE_SET_LENGTH, stateSetToObject
} from '../../src/logic-generator/binary-state';
import {
    getStateSet
} from '../../src/states';
import {
    orderedActionList
} from '../../src/actions';
import {
    ActionName, StateSet, StateResolveFunctionInput, QueryParams
} from '../../src/types';
import {
    getExampleStateResolveFunctionInput
} from '../helper/input';
import { Human } from '../../src/logic-generator/types';
import { randomHumans } from '../../src/logic-generator/data-generator';
import { getQueryParamsByMongoQuery, compileSort } from '../../src/logic-generator/minimongo-helper';
import { clone } from 'async-test-util';
import { getQueryVariations, findAllQuery, DEFAULT_EXAMPLE_QUERY } from '../../src/logic-generator/queries';
import { insertFiveThenChangeAgeOfOne } from '../../src/logic-generator/test-procedures';
import { lastOfArray } from '../../src/util';
describe('calculate-action-for-state.test.ts', () => {
    it('should not throw and return an action', async () => {
        const input = getExampleStateResolveFunctionInput();
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet,
            new Map(),
            [
                getQueryVariations()[0]
            ]
        );
        assert.ok(orderedActionList.includes(action));
    });
    it('should have the given action insertFirst', async () => {
        const input = getExampleStateResolveFunctionInput();
        const stateSet = getStateSet(input); // 10001000100101011
        const action: ActionName = await calculateActionForState(
            stateSet,
            new Map(),
            [
                DEFAULT_EXAMPLE_QUERY
            ]
        );
        assert.equal(action, 'insertFirst');
    });
    it('should have action "doNothing" on impossible state', async () => {
        const stateSet: StateSet = new Array(STATE_SET_LENGTH)
            .fill('1')
            .join(''); // '111111111...'
        const action: ActionName = await calculateActionForState(
            stateSet
        );
        assert.equal(action, 'doNothing');
    });
    it('should have "removeExistingAndInsertAtSortPosition"', async () => {
        const query = {
            selector: {},
            limit: 5,
            sort: ['age']

        };
        const events = insertFiveThenChangeAgeOfOne();
        const previousResults: Human[] = events
            .filter(ev => ev.operation === 'INSERT')
            .map(ev => ev.doc as Human)
            .slice(0, query.limit);

        const updateChangeEvent = lastOfArray(events);
        const input: StateResolveFunctionInput<Human> = {
            previousResults,
            changeEvent: updateChangeEvent,
            queryParams: getQueryParamsByMongoQuery(query)
        };
        const stateSet = getStateSet(input);
        const action: ActionName = await calculateActionForState(
            stateSet,
            new Map(),
            [query]
        );
        assert.strictEqual(
            action,
            'removeExistingAndInsertAtSortPosition'
        );
    });
});
