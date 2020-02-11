import { RootNode } from './root-node';
import { AbstractNode } from './abstract-node';
import { NonRootNode, NonLeafNode } from './types';

/**
 * run some tests on the bdd
 * to ensure everything is correct
 */
export function ensureCorrectBdd(bdd: RootNode) {
    const jsonString = JSON.stringify(bdd.toJSON(true));


    let allNodes: AbstractNode[] = [];
    const nodesById: Map<string, AbstractNode> = new Map();
    bdd.getLevels().forEach(level => {
        const levelNodes = bdd.getNodesOfLevel(level);
        levelNodes.forEach(node => {
            nodesById.set(node.id, node);
        });
        allNodes = allNodes.concat(levelNodes);
    });


    const recursiveNodes = getNodesRecursive(bdd);

    if (allNodes.length !== recursiveNodes.size) {

        console.log(JSON.stringify(allNodes.map(n => n.id).sort(), null, 2));
        console.log(JSON.stringify(Array.from(recursiveNodes).map(n => n.id).sort(), null, 2));

        throw new Error(
            'ensureCorrectBdd() ' +
            'nodes in list not equal size to recursive nodes ' +
            'allNodes: ' + allNodes.length + ' ' +
            'recursiveNodes: ' + recursiveNodes.size
        );
    }

    allNodes.forEach(node => {
        if (node.isRootNode()) {
            return;
        }
        const useNode = node as NonRootNode;

        if (node.deleted) {
            throw new Error(
                'ensureCorrectBdd() ' +
                'bdd includes a deleted node'
            );
        }

        // each node should have a parent
        if (useNode.parents.size === 0) {
            throw new Error(
                'ensureCorrectBdd() ' +
                'node has no parent ' + useNode.id
            );
        }

        // each parent should have the child as branch
        useNode.parents.getAll().forEach(parent => {
            if (!parent.branches.hasBranchAsNode(useNode)) {
                throw new Error(
                    'ensureCorrectBdd() ' +
                    'parent node does not have child as branch'
                );
            }
        });
    });


    if (jsonString.includes('"deleted":true')) {
        throw new Error(
            'ensureCorrectBdd() ' +
            'bdd includes a deleted node'
        );
    }
}

export function getNodesRecursive(
    node: AbstractNode,
    set: Set<AbstractNode> = new Set()
): Set<AbstractNode> {
    set.add(node);
    if (!node.isLeafNode()) {
        const useNode = node as NonLeafNode;

        const branch1 = useNode.branches.getBranch('0');
        set.add(branch1);
        getNodesRecursive(branch1, set);

        const branch2 = useNode.branches.getBranch('1');
        set.add(branch2);
        getNodesRecursive(branch2, set);
    }

    return set;
}
