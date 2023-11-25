import type { Human, Procedure } from './types.js';
import type { ChangeEvent } from '../../src/types/index.js';
/**
 * Do not use a too height value
 * so that it more often triggers sort changes.
 */
export declare const HUMAN_MAX_AGE = 20;
export declare function randomHuman(partial?: Partial<Human>): Human;
export declare const STATIC_RANDOM_HUMAN: Human;
export declare function randomHumans(amount?: number, partial?: Partial<Human>): Human[];
export declare const mutateFieldFunctions: {
    [k: string]: (i: Human) => void;
};
export declare function randomChangeHuman(input: Human): Human;
export declare function randomChangeEvent(allDocs: Human[], favor: 'INSERT' | 'DELETE'): ChangeEvent<Human>;
export declare const randomEventsPrematureCalculation: {
    [amount: number]: Procedure;
};
export declare function getRandomChangeEvents(amount?: number): Procedure;
export declare function fillRandomEvents(amount: number): void;
export declare function _getRandomChangeEvents(amount?: number): Procedure;
