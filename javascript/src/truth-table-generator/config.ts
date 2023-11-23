import path from 'path';

export const OUTPUT_FOLDER_PATH = path.join(
    __dirname,
    'output'
);

export const OUTPUT_TRUTH_TABLE_PATH = path.join(
    OUTPUT_FOLDER_PATH,
    'truth-table.json'
).replace('dist/cjs/', '');

export const FUZZING_QUERIES_PATH = path.join(
    OUTPUT_FOLDER_PATH,
    'queries.json'
).replace('dist/cjs/', '');

export const FUZZING_PROCEDURES_PATH = path.join(
    OUTPUT_FOLDER_PATH,
    'procedures.json'
).replace('dist/cjs/', '');
