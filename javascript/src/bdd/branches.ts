import { BooleanString, NonRootNode, NonLeafNode } from './types';
import { oppositeBoolean } from './util';
import { AbstractNode } from './abstract-node';

/**
 * represents the branches of a single node
 */
export class Branches {
    public deleted: boolean = false;
    private branches: {
        [k in BooleanString]: NonRootNode
    } = {} as any;

    constructor(
        private node: NonLeafNode
    ) { }

    public setBranch(which: BooleanString, branchNode: NonRootNode) {
        const previous = this.branches[which];
        if (previous === branchNode) {
            return;
        }

        // set new branch
        this.branches[which] = branchNode;
        branchNode.parents.add(this.node);
    }

    public getKeyOfNode(node: NonRootNode): BooleanString {
        if (this.getBranch('0') === node) {
            return '0';
        } else if (this.getBranch('1') === node) {
            return '1';
        } else {
            throw new Error('none matched');
        }
    }

    public getBranch(which: BooleanString): NonRootNode {
        return this.branches[which];
    }

    public getBothBranches(): NonRootNode[] {
        return [
            this.getBranch('0'),
            this.getBranch('1')
        ];
    }

    public hasBranchAsNode(node: AbstractNode): boolean {
        if (
            this.getBranch('0') === node ||
            this.getBranch('1') === node
        ) {
            return true;
        } else {
            return false;
        }
    }

    public hasNodeIdAsBranch(id: string): boolean {
        if (
            this.getBranch('0').id === id ||
            this.getBranch('1').id === id
        ) {
            return true;
        } else {
            return false;
        }
    }

    public areBranchesStrictEqual() {
        return this.branches['0'] === this.branches['1'];
    }

    public hasEqualBranches() {
        return JSON.stringify(this.branches['0']) ===
            JSON.stringify(this.branches['1']);
    }
}

export function ensureNodesNotStrictEqual(
    node1: NonRootNode,
    node2: NonRootNode
) {
    if (node1 === node2) {
        throw new Error('cannot have two strict equal branches');
    }
}
