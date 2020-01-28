
export type WriteOperation = 'INSERT' | 'UPDATE' | 'DELETE';
export type UNKNOWN = 'UNKNOWN';

export interface ChangeEvent<DocType> {
    operation: WriteOperation;
    newDocument: DocType;
    /**
     * null on inserts
     */
    previousDocument: DocType | null | UNKNOWN;
}

export type ResultKeyDocumentMap<DocType> = Map<string, DocType>;

export type ActionName = string;

export interface QueryParams<DocType> {
    primaryKey: string;
    sortFields: string[];
    skip: number;
    limit: number;
    queryMatcher: QueryMatcher<DocType>;
    sortComparator: SortComparator<DocType>;
}

export type QueryMatcher<DocType> = (doc: DocType) => boolean;
export type SortComparator<DocType> = (a: DocType, b: DocType) => 1 | 0 | -1;