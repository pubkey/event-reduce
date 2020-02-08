import { ChangeEvent, StateSet } from '../types';

export interface Human {
    _id: string; // primary
    name: string;
    gender: 'm' | 'f';
    age: number;
}

export type MongoQuery = {
    selector: any;
    skip?: number;
    limit?: number;
    sort?: any[]
};

// a procedure is a list of events used in tests
export type Procedure = ChangeEvent<Human>[];

export type StateActionIdMap = Map<StateSet, number>;
