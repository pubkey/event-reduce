import * as assert from 'assert';
import {
    orderedActionList,
    actionFunctions
} from '../../src/actions';
import { ActionFunction, ActionName } from '../../src/types';
import { randomChangeEvent } from '../../src/logic-generator/data-generator';
import { getQueryParamsByMongoQuery } from '../../src/logic-generator/minimongo-helper';

describe('actions.test.ts', () => {
    it('should have the correct amount of actions', () => {
        assert.strictEqual(
            orderedActionList.length,
            Object.keys(actionFunctions).length
        );
    });
    it('all functions should not crash on whatever input', () => {
        Object.entries(actionFunctions).forEach((entry) => {
            const action: ActionName = entry[0] as ActionName;
            const fn: ActionFunction<any> = entry[1];
            if (action === 'runFullQueryAgain') {
                return;
            }
            fn({
                previousResults: [],
                changeEvent: randomChangeEvent([]),
                keyDocumentMap: new Map(),
                queryParams: getQueryParamsByMongoQuery({
                    selector: {}
                })
            });
        });
    });
});
