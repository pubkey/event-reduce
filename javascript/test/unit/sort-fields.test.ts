import * as assert from 'assert';
import { getSortFieldsOfQuery, normalizeSortField } from '../../src/util.js';

describe('sort-fields.test.ts', () => {
    describe('normalizeSortField()', () => {
        it('should return the field name for all sort formats', () => {
            assert.strictEqual(normalizeSortField('age'), 'age');
            assert.strictEqual(normalizeSortField('-age'), 'age');
            assert.strictEqual(normalizeSortField(['age', 'desc']), 'age');
            assert.strictEqual(normalizeSortField({ age: 'desc' }), 'age');
        });
    });
    describe('getSortFieldsOfQuery()', () => {
        it('should use the primary key when there is no sort', () => {
            assert.deepStrictEqual(getSortFieldsOfQuery({ selector: {} } as any), ['_id']);
        });
        it('should return the fields of a sort with strings', () => {
            assert.deepStrictEqual(
                getSortFieldsOfQuery({ selector: {}, sort: ['-age', 'name', '_id'] }),
                ['age', 'name', '_id']
            );
        });
        it('should return the fields of a sort with [field, direction] arrays', () => {
            assert.deepStrictEqual(
                getSortFieldsOfQuery({ selector: {}, sort: [['age', 'desc'], ['_id', 'asc']] as any }),
                ['age', '_id']
            );
        });
        it('should return the fields of a sort with objects', () => {
            assert.deepStrictEqual(
                getSortFieldsOfQuery({ selector: {}, sort: [{ age: 'desc' }, { _id: 'asc' }] as any }),
                ['age', '_id']
            );
        });
    });
});
