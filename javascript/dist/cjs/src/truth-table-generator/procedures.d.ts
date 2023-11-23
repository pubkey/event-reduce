import type { ChangeEvent } from '../types/index.js';
import type { Human, Procedure } from './types.js';
export declare function insertChangeAndCleanup(): ChangeEvent<Human>[];
export declare function insertFiveSorted(): ChangeEvent<Human>[];
export declare function insertFiveSortedThenRemoveSorted(): ChangeEvent<Human>[];
export declare function oneThatWasCrashing(): ChangeEvent<Human>[];
export declare function sortParamChanged(): ChangeEvent<Human>[];
export declare function getTestProcedures(): Procedure[];
