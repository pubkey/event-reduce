import { BooleanString } from './types';

export function booleanStringToBoolean(str: BooleanString): boolean {
    if (str === '1') {
        return true;
    } else {
        return false;
    }
}

export function lastChar(str: string): string {
    return str.slice(-1);
}

let lastIdGen = 0;
export function nextNodeId(): string {
    const ret = 'node_' + lastIdGen;
    lastIdGen++;
    return ret;
}