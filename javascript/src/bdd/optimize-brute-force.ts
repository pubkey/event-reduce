import { TruthTable } from './types';
import { RootNode } from './root-node';
import { createBddFromTruthTable } from './create-bdd-from-truth-table';
import { firstKeyOfMap, shuffleArray } from './util';

/**
 * a function that is called each time
 * a 'better' bdd was found
 */
export type OptmisiationCallback = (res: OptimisationResult) => void;

export interface OptimisationResult {
    bdd: RootNode;
    mapping?: BooleanFunctionReorderMapping;
    truthTable: TruthTable;
}

/**
 * returns the bdd with less nodes
 */
export function defaultCompareResults(a: RootNode, b: RootNode): RootNode {
    if (a.countNodes() <= b.countNodes()) {
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
    afterBddCreation?: (bdd: RootNode) => void;
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
    compareResults = defaultCompareResults,
    afterBddCreation = () => null
}: OptimizeBruteForceInput): OptimisationResult {

    const initialBdd = createBddFromTruthTable(truthTable);
    afterBddCreation(initialBdd);
    initialBdd.minimize();
    let currentBestResult: OptimisationResult = {
        truthTable,
        bdd: initialBdd
    };

    initialBdd.log();
    console.log('initial nodes amount: ' + initialBdd.countNodes());

    let t = 0;
    while (t < itterations) {
        t++;
        console.log('-'.repeat(50));
        console.log('optimizeBruteForce() itterate once');
        const shuffledOrdering = shuffleBooleanOrdering(truthTable);
        const nextBdd = createBddFromTruthTable(shuffledOrdering.newTable);
        afterBddCreation(nextBdd);
        nextBdd.minimize();
        console.log('got new bdd with nodes amount of ' + nextBdd.countNodes());
        //        nextBdd.log();
        const betterBdd = compareResults(
            currentBestResult.bdd,
            nextBdd
        );
        if (betterBdd === nextBdd) {
            console.log('#'.repeat(50));
            console.log('found better bdd ' + nextBdd.countNodes());
            currentBestResult = {
                bdd: nextBdd,
                truthTable: shuffledOrdering.newTable,
                mapping: shuffledOrdering.mapping
            };
            onBetterBdd(currentBestResult);
        }
    }


    return currentBestResult;
}


export type BooleanFunctionReorderMapping = {
    [indexAfter: number]: number; // to indexBefore
};

export function shuffleBooleanOrdering(
    truthTable: TruthTable
): {
    newTable: TruthTable,
    mapping: BooleanFunctionReorderMapping
} {
    const firstKey = firstKeyOfMap(truthTable);
    const arrayWithIndexes = getArrayWithIndexes(firstKey.length);
    const shuffled = shuffleArray(arrayWithIndexes);

    const mapping: BooleanFunctionReorderMapping = {};
    const mappingBeforeToAfter: BooleanFunctionReorderMapping = {};
    shuffled.forEach((indexBefore, indexAfter) => {
        mapping[indexAfter] = indexBefore;
        mappingBeforeToAfter[indexBefore] = indexAfter;
    });

    const newTable: TruthTable = new Map();
    for (const [key, value] of truthTable.entries()) {
        const newKey = changeKeyOrder(
            key,
            mappingBeforeToAfter
        );
        newTable.set(
            newKey,
            value
        );
    }

    return {
        newTable,
        mapping
    };
}

export function changeKeyOrder(
    oldKey: string,
    mappingBeforeToAfter: BooleanFunctionReorderMapping
): string {
    const chars = oldKey
        .split('')
        .map((char, indexBefore) => {
            return {
                char,
                indexBefore,
                indexAfter: mappingBeforeToAfter[indexBefore]
            };
        })
        .sort((a, b) => a.indexAfter - b.indexAfter)
        .map(charObj => charObj.char)
        .join('');
    return chars;
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