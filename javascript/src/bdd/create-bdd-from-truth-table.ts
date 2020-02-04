import { RootNode } from './root-node';
import {
    TruthTable,
    BddNode,
    BooleanString,
    NonLeafNode
} from './types';
import { booleanStringToBoolean, lastChar } from './util';
import { InternalNode } from './internal-node';
import { LeafNode } from './leaf-node';

export function createBddFromTruthTable(
    truthTable: TruthTable
): RootNode {
    const root = new RootNode();
    const leafNodeByValue: Map<string, LeafNode> = new Map();

    for (const [stateSet, value] of truthTable) {
        let lastNode: NonLeafNode = root;
        for (let i = 0; i < (stateSet.length - 1); i++) {
            const level = i + 1;
            const state: BooleanString = stateSet.charAt(i) as BooleanString;
            if (!lastNode.branches[state]) {
                lastNode.branches[state] = new InternalNode(
                    level,
                    lastNode,
                    root
                );
            }
            lastNode = lastNode.branches[state] as NonLeafNode;
        }

        // last node is leaf-node
        const lastState = lastChar(stateSet);
        if (lastNode.branches[lastState]) {
            throw new Error('leafNode already exists, this should not happen');
        }
        lastNode.branches[lastState] = new LeafNode(
            stateSet.length,
            value,
            lastNode,
            root
        );
    }

    return root;
}
