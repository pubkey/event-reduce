import * as assert from 'assert';
import { calculateActionName, getStateSet, orderedStateList, runAction } from '../../src/index.js';
import type { ChangeEvent, DocumentId, QueryParams, StateResolveFunctionInput } from '../../src/index.js';

/**
 * Ids are compared with ===, without any conversion:
 * a string id never equals a number id, so '1' and 1 are two different documents.
 */
describe('id-types.test.ts', () => {
    const queryParams: QueryParams<any> = {
        primaryKey: 'id',
        sortFields: ['age', 'id'],
        queryMatcher: () => true,
        sortComparator: (a, b) => a.age !== b.age ? (a.age < b.age ? -1 : 1) : (String(a.id) < String(b.id) ? -1 : 1)
    };
    const wasInResult = (input: StateResolveFunctionInput<any>) =>
        getStateSet(input)[orderedStateList.indexOf('wasInResult')] === '1';

    function apply(results: any[], changeEvent: ChangeEvent<any>, withMap: boolean): any[] {
        const keyDocumentMap = withMap ? new Map(results.map(doc => [doc.id, doc])) : undefined;
        const action = calculateActionName({ queryParams, changeEvent, previousResults: results, keyDocumentMap });
        return runAction(action, queryParams, changeEvent, results, keyDocumentMap);
    }

    it('the types allow number ids', () => {
        type Doc = { id: number; age: number; };
        const typedParams: QueryParams<Doc> = {
            primaryKey: 'id',
            getDocumentId: doc => doc.id,
            sortFields: ['age', 'id'],
            queryMatcher: () => true,
            sortComparator: (a, b) => a.age !== b.age ? (a.age < b.age ? -1 : 1) : (a.id < b.id ? -1 : 1)
        };
        const previous: Doc = { id: 1, age: 1 };
        const changed: Doc = { id: 1, age: 9 };
        const other: Doc = { id: 2, age: 5 };
        const changeEvent: ChangeEvent<Doc> = { operation: 'UPDATE', id: 1, doc: changed, previous };
        const id: DocumentId = changeEvent.id;
        const keyDocumentMap = new Map<DocumentId, Doc>([[1, previous], [2, other]]);
        const results = [previous, other];
        const action = calculateActionName({ queryParams: typedParams, changeEvent, previousResults: results, keyDocumentMap });
        runAction(action, typedParams, changeEvent, results, keyDocumentMap);
        assert.deepStrictEqual(results, [other, changed]);
        assert.strictEqual(keyDocumentMap.get(id), changed);
    });

    [false, true].forEach(withMap => {
        describe(withMap ? 'with a key document map' : 'without a key document map', () => {
            it('number ids work when the documents and the change events use numbers', () => {
                const previous = { id: 1, age: 1 };
                const other = { id: 2, age: 5 };
                const changed = { id: 1, age: 9 };
                const changeEvent: ChangeEvent<any> = { operation: 'UPDATE', id: 1, doc: changed, previous };
                assert.deepStrictEqual(apply([previous, other], changeEvent, withMap), [other, changed]);
            });
            it('a string id never equals a number id', () => {
                const numberDoc = { id: 1, age: 1 };
                const stringDoc = { id: '1', age: 2 };
                const changeEvent: ChangeEvent<any> = { operation: 'INSERT', id: '1', doc: stringDoc, previous: null };
                const input: StateResolveFunctionInput<any> = {
                    queryParams,
                    changeEvent,
                    previousResults: [numberDoc],
                    keyDocumentMap: withMap ? new Map([[1, numberDoc]]) : undefined
                };
                // the document '1' is not in the results, although the document 1 is
                assert.strictEqual(wasInResult(input), false);
                // so the insert adds a second document and does not replace the first
                assert.deepStrictEqual(apply([numberDoc], changeEvent, withMap), [numberDoc, stringDoc]);
            });
        });
    });
});
