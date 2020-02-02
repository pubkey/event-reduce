import {
    WriteOperation,
    UNKNOWN
} from './index';

export interface ChangeEventBase {
    operation: WriteOperation;
    id: string; // value of the primary key
}

export interface ChangeEventInsert<DocType> extends ChangeEventBase {
    operation: 'INSERT';
    doc: DocType;
    previous: null | UNKNOWN;
}

export interface ChangeEventUpdate<DocType> extends ChangeEventBase {
    operation: 'UPDATE';
    doc: DocType;
    previous: DocType | UNKNOWN;
}

export interface ChangeEventDelete<DocType> extends ChangeEventBase {
    operation: 'DELETE';
    doc: null;
    previous: DocType | UNKNOWN;
}

export type ChangeEvent<DocType> = ChangeEventInsert<DocType> | ChangeEventUpdate<DocType> | ChangeEventDelete<DocType>;
