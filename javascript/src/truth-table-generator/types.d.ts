import type { ChangeEvent, StateSet } from '../types/index.js';

export interface Human {
    _id: string; // primary
    name: string;
    gender: 'm' | 'f';
    age: number;
}

// a procedure is a list of events used in tests
export type Procedure = ChangeEvent<Human>[];

export type StateActionIdMap = Map<StateSet, number>;
