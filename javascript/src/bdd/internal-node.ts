import { Branches } from './branches';
import { Parents } from './parents';
import { RootNode } from './root-node';
import { AbstractNode } from './abstract-node';
import { NonLeafNode, NonRootNode } from '.';

export class InternalNode extends AbstractNode {
    public branches: Branches = new Branches(this);
    public parents = new Parents(this);

    constructor(
        level: number,
        rootNode: RootNode,
        parent: NonLeafNode
    ) {
        super(level, rootNode, 'InternalNode');
        this.parents.add(parent);
    }



    /**
     * by the reduction-rule of bdd,
     * if both branches are equal,
     * we can remove this node from the bdd
     */
    applyReductionRule(): boolean {

        // console.log('applyReductionRule() ' + this.id);

        if (this.branches.hasEqualBranches()) {
            this.ensureNotDeleted('applyReductionRule');
            const keepBranch: NonRootNode = this.branches.getBranch('0');

            // move own parents to keepBranch
            const ownParents = this.parents.getAll();
            ownParents.forEach(parent => {
                // console.log('ownParent: ' + parent.id);
                const branchKey = parent.branches.getKeyOfNode(this);
                parent.branches.setBranch(branchKey, keepBranch);

                // remove parents from own list
                // this will auto-remove the connection to the other '1'-branch
                this.parents.remove(parent);

                // if parent has now two equal branches,
                // we have to apply the reduction again
                // to ensure we end in a valid state
                if (parent.branches.areBranchesStrictEqual() && parent.isInternalNode()) {
                    (parent as InternalNode).applyReductionRule();
                }
            });

            return true;
        }
        return false;
    }

}
