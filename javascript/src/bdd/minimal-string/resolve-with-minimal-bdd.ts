import {
    SimpleBdd,
    ResolverFunctions,
    SimpleBddNode
} from '../types';
import { booleanToBooleanString } from '../util';

export function resolveWithMinimalBdd(
    simpleBdd: SimpleBdd,
    fns: ResolverFunctions,
    input: any
): number {
    let currentNode: SimpleBddNode | SimpleBdd = simpleBdd;
    let currentLevel: number = 0;
    while (true) {
        const booleanResult = fns[currentLevel](input);
        const branchKey = booleanToBooleanString(booleanResult);
        currentNode = currentNode[branchKey];
        if (typeof currentNode === 'number' || typeof currentNode === 'string') {
            return currentNode as any;
        } else {
            currentLevel = currentNode.l;
        }
    }
}
