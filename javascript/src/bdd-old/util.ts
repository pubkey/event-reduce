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

/**
 * @link https://stackoverflow.com/a/16155417
 */
export function decimalToPaddedBinary(
    decimal: number,
    padding: number
) {
    const binary = (decimal >>> 0).toString(2);
    const padded = binary.padStart(padding, '0');
    return padded;
}

export function binaryToDecimal(binary: string): number {
    return parseInt(binary, 2);
}

export function minBinaryWithLength(length: number): string {
    return new Array(length).fill(0).map(() => '0').join('');
}

export function maxBinaryWithLength(length: number): string {
    return new Array(length).fill(0).map(() => '1').join('');
}

export function getNextStateSet(
    stateSet: string
): string {
    const decimal = binaryToDecimal(stateSet);
    const increase = decimal + 1;
    const binary = decimalToPaddedBinary(increase, stateSet.length);
    return binary;
}

export function firstKeyOfMap(map: Map<string, any>): string {
    const iterator1 = map.keys();
    return iterator1.next().value;
}

/**
 * Shuffles array in place. ES6 version
 * @link https://stackoverflow.com/a/6274381
 */
export function shuffleArray<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}