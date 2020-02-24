import {
    ChangeEvent
} from 'event-reduce-js';

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
    sort?: any[]
};

export type Query = MongoQuery; // TODO add queries for firestore etc..

export interface DatabaseImplementation<QueryType = Query> {
    init(): Promise<void>;
    getExampleQueries(): QueryType[];
    getRawResults(query: QueryType): Promise<Human[]>;
    getAll(): Promise<Human[]>;

    // returns the amount of time it took in ms
    handleEvent(changeEvent: ChangeEvent<Human>): Promise<number>;
}
