import type { ChangeEvent, StateSet } from '../types/index.js';
export interface Human {
    _id: string;
    name: string;
    gender: 'm' | 'f';
    age: number;
}
export type Procedure = ChangeEvent<Human>[];
export type StateActionIdMap = Map<StateSet, number>;
