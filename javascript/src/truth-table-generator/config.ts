import * as path from 'path';
import type { UNKNOWN } from '../types';

export const OUTPUT_FOLDER_PATH = path.join(
    __dirname,
    'output'
);

export const OUTPUT_TRUTH_TABLE_PATH = path.join(
    OUTPUT_FOLDER_PATH,
    'truth-table.json'
);

export const FUZZING_QUERIES_PATH = path.join(
    OUTPUT_FOLDER_PATH,
    'queries.json'
);

export const FUZZING_PROCEDURES_PATH = path.join(
    OUTPUT_FOLDER_PATH,
    'procedures.json'
);



export const UNKNOWN_VALUE: UNKNOWN = 'UNKNOWN';
