import * as path from 'path';
import { UNKNOWN } from '../types';

export const LOGIC_MAP_PATH = path.join(
    __dirname,
    'logic-map-output'
);

const MODULE_BASE_PATH = path.join(
    __dirname,
    '../../'
);

export const UNKNOWN_VALUE: UNKNOWN = 'UNKNOWN';
