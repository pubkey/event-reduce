import type {
    DocumentId,
    WriteOperation
} from './index.js';

export interface ChangeEventBase {
    operation: WriteOperation;
    /**
     * document id.
     * It is compared with === to the ids of the documents,
     * so it must have the same type: the string '1' never equals the number 1.
     * value of the primary key.
     */
    id: DocumentId;
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
