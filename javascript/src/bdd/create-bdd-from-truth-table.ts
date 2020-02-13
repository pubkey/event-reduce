import { RootNode } from './root-node';
import { lastChar } from './util';
import { InternalNode } from './internal-node';
import { LeafNode } from './leaf-node';
import { TruthTable, NonLeafNode, BooleanString } from './types';

export function createBddFromTruthTable(
    truthTable: TruthTable
): RootNode {
    const root = new RootNode();

    for (const [stateSet, value] of truthTable) {
        let lastNode: NonLeafNode = root;

        // itterate over each char of the state
        for (let i = 0; i < (stateSet.length - 1); i++) {
            const level = i + 1;
            const state: BooleanString = stateSet.charAt(i) as BooleanString;

            // if node for this state-char not exists, add new one
            if (!lastNode.branches.getBranch(state)) {
                lastNode.branches.setBranch(
                    state,
                    new InternalNode(
                        level,
                        root,
                        lastNode,
                    )
                );
            }
            lastNode = lastNode.branches.getBranch(state) as NonLeafNode;
        }

        // last node is leaf-node
        const lastState = lastChar(stateSet) as BooleanString;
        if (lastNode.branches.getBranch(lastState)) {
            throw new Error('leafNode already exists, this should not happen');
        }
        lastNode.branches.setBranch(
            lastState,
            new LeafNode(
                stateSet.length,
                root,
                value,
                lastNode,
            )
        );
    }

    return root;
}
