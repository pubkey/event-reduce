import {
    ChangeEvent
} from 'event-reduce-js';
import { QueryParams } from 'event-reduce-js';

export type Procedure<DocType> = ChangeEvent<DocType>[];

export interface Human {
    _id: string; // primary
    name: string;
    gender: 'm' | 'f';
    age: number;
}
export type IdToDocumentMap = Map<string, Human>;

export type MongoQuery = {
    selector: any;
    skip?: number;
    limit?: number;
    sort: any[]
};

export type FirestoreQueryPart = {
    field: string;
    op: '==' | '>=' | '<=' | '<' | '>';
    value: string | number;
};

export type FirestoreQuery = FirestoreQueryPart[];

export type Query = MongoQuery | FirestoreQuery;

export interface DatabaseImplementation<QueryType = Query> {
    getName(): string;
    getStorageOptions(): string[];

    init(storageOption: string): Promise<void>;
    getExampleQueries(): QueryType[];
    getQueryParams(query: QueryType): QueryParams<any>;
    getRawResults(query: QueryType): Promise<Human[]>;
    getAll(): Promise<Human[]>;

    // returns the amount of time it took in ms
    handleEvent(changeEvent: ChangeEvent<Human>): Promise<number>;
}
