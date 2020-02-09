import { TruthTable } from './types';
import { RootNode } from './root-node';
import { createBddFromTruthTable } from './create-bdd-from-truth-table';
import { firstKeyOfMap, shuffleArray } from './util';


/**
 * a function that is called each time
 * a 'better' bdd was found
 */
export type OptmisiationCallback = (bdd: RootNode) => void;


export function defaultCompareResults(a: RootNode, b: RootNode): RootNode {
    if (a.countNodes() >= b.countNodes()) {
        return a;
    } else {
        return b;
    }
}

export interface OptimizeBruteForceInput {
    truthTable: TruthTable;
    itterations?: number;
    onBetterBdd?: OptmisiationCallback;
    // a function that returns the 'better' bdd
    compareResults?: (a: RootNode, b: RootNode) => RootNode;
}

/**
 * optimises the ordering of the boolean functions
 * by randomly sorting the array
 * and checking the resulting bdd
 */
export function optimizeBruteForce({
    truthTable,
    itterations = Infinity,
    onBetterBdd = () => null,
    compareResults = defaultCompareResults
}: OptimizeBruteForceInput): RootNode {

    let currentBestBdd = createBddFromTruthTable(truthTable);

    let t = 0;
    while (t < itterations) {
        t++;

    }


    return currentBestBdd;
}

export interface BooleanFunctionReorderItem {
    before: any;
    after: any;
}

export type BooleanFunctionReorderMapping = BooleanFunctionReorderItem[];

export function shuffleBooleanOrdering(
    truthTable: TruthTable
): {
    newTable: TruthTable,
    mapping: BooleanFunctionReorderMapping
} {
    const firstKey = firstKeyOfMap(truthTable);
    const arrayWithIndexes = getArrayWithIndexes(firstKey.length);
    const shuffled = shuffleArray(arrayWithIndexes);

    return {} as any; // TODO continue here
}

export function getArrayWithIndexes(size: number): number[] {
    const ret: number[] = [];
    let last = 0;
    while (last < size) {
        ret.push(last);
        last++;
    }
    return ret;
}
