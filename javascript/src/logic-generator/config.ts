import * as path from 'path';
import { UNKNOWN } from '../types';

export const LOGIC_MAP_PATH = path.join(
    __dirname,
    'logic-map-output'
);

export const VALID_STATE_SET_PATH = path.join(
    LOGIC_MAP_PATH,
    'valid-state-set.json'
);


const MODULE_BASE_PATH = path.join(
    __dirname,
    '../../'
);

export const UNKNOWN_VALUE: UNKNOWN = 'UNKNOWN';
