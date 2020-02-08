import * as assert from 'assert';

import {
    findValidStates
} from '../../src/logic-generator/find-valid-states';
import { getQueryVariations } from '../../src/logic-generator/queries';
import {
    insertChangeAndCleanup
} from '../../src/logic-generator/test-procedures';
import { MongoQuery, Human } from '../../src/logic-generator/types';
import { ChangeEvent } from '../../src/types';

describe('find-valid-states.test.ts', () => {
    it('should find some states', async () => {
        const queryVarations: MongoQuery[] = [
            getQueryVariations()[0],
            getQueryVariations()[1],
            getQueryVariations()[2]
        ];
        const states = await findValidStates(
            queryVarations,
            [
                insertChangeAndCleanup()
            ]
        );

        assert.ok(states.size > 5);

        // overwriting previous=UNKNOWN_VALUE should produce more states
        const statesUnknownPrevious = await findValidStates(
            queryVarations,
            [
                insertChangeAndCleanup(true)
            ]
        );
        const merged = new Set([...states, ...statesUnknownPrevious]);
        assert.ok(merged.size > states.size);
    });
    it('should find "01010010000000001"', async () => {
        const events: ChangeEvent<Human>[] = [
            {
                operation: 'INSERT',
                id: '5mixfwp9lp',
                doc: {
                    _id: '5mixfwp9lp',
                    name: 'ashleigh',
                    gender: 'm',
                    age: 30
                },
                previous: null
            },
            {
                operation: 'DELETE',
                id: '5mixfwp9lp',
                doc: null,
                previous: 'UNKNOWN'
            },
            {
                operation: 'INSERT',
                id: '48yqpg2nrd',
                doc: {
                    _id: '48yqpg2nrd',
                    name: 'yessenia',
                    gender: 'f',
                    age: 8
                },
                previous: null
            },
            {
                operation: 'UPDATE',
                id: '48yqpg2nrd',
                doc: {
                    _id: '48yqpg2nrd',
                    name: 'yessenia',
                    gender: 'm',
                    age: 8
                },
                previous: {
                    _id: '48yqpg2nrd',
                    name: 'yessenia',
                    gender: 'f',
                    age: 8
                }
            }
        ];
        const query = { selector: { gender: 'm' }, limit: 2, sort: ['_id'] };


        const states = await findValidStates(
            [query],
            [
                events
            ]
        );
        assert.ok(states.has('01010010000000001'));
    });
});
