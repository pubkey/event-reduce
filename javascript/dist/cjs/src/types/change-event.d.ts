import type { WriteOperation } from './index.js';
export interface ChangeEventBase {
    operation: WriteOperation;
    /**
     * document id,
     * value of the primary key.
     */
    id: string;
}
export interface ChangeEventInsert<DocType> extends ChangeEventBase {
    operation: 'INSERT';
    doc: DocType;
    previous: null;
}
export interface ChangeEventUpdate<DocType> extends ChangeEventBase {
    operation: 'UPDATE';
    doc: DocType;
    previous: DocType;
}
export interface ChangeEventDelete<DocType> extends ChangeEventBase {
    operation: 'DELETE';
    doc: null;
    previous: DocType;
}
export type ChangeEvent<DocType> = ChangeEventInsert<DocType> | ChangeEventUpdate<DocType> | ChangeEventDelete<DocType>;
