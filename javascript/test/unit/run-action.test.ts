import * as assert from 'assert';
import { runAction } from '../../src/index.js';
import type { ActionName, ChangeEvent, QueryParams } from '../../src/types/index.js';

type Doc = { id: string; };

const queryParams: QueryParams<Doc> = {
    primaryKey: 'id',
    sortFields: ['id'],
    queryMatcher: () => true,
    sortComparator: (a, b) => a.id < b.id ? -1 : 1
};
const changeEvent: ChangeEvent<Doc> = {
    operation: 'INSERT',
    id: 'b',
    doc: { id: 'b' },
    previous: null
};

describe('run-action.test.ts', () => {
    it('should run the action and return the mutated results', () => {
        const results: Doc[] = [{ id: 'a' }];
        const ret = runAction('insertLast', queryParams, changeEvent, results);
        assert.strictEqual(ret, results);
        assert.deepStrictEqual(results.map(d => d.id), ['a', 'b']);
    });
    it('should throw EventReduce:UNK_ACT when the name is not an action', () => {
        const results: Doc[] = [{ id: 'a' }];
        assert.throws(
            () => runAction('notAnAction' as ActionName, queryParams, changeEvent, results),
            { message: 'EventReduce:UNK_ACT notAnAction' }
        );
        assert.throws(
            () => runAction(undefined as any, queryParams, changeEvent, results),
            /^Error: EventReduce:UNK_ACT/
        );
        assert.deepStrictEqual(results.map(d => d.id), ['a']);
    });
    it('should throw EventReduce:UNK_ACT for alwaysWrong and unknownAction', () => {
        assert.throws(() => runAction('alwaysWrong', queryParams, changeEvent, []), /EventReduce:UNK_ACT/);
        assert.throws(() => runAction('unknownAction', queryParams, changeEvent, []), /EventReduce:UNK_ACT/);
    });
    it('should throw EventReduce:RUN_FULL for runFullQueryAgain', () => {
        assert.throws(() => runAction('runFullQueryAgain', queryParams, changeEvent, []), /EventReduce:RUN_FULL/);
    });
});
