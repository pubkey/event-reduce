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

    /**
     * by the elimination-rule of bdd,
     * if two branches of the same level are equal,
     * one can be removed
     *
     * See page 21 at:
     * @link https://people.eecs.berkeley.edu/~sseshia/219c/lectures/BinaryDecisionDiagrams.pdf
     */
    applyEliminationRule(
        // can be provided for better performance
        nodesOfSameLevel?: InternalNode[]
    ): boolean {
        this.ensureNotDeleted('applyEliminationRule');
        if (!nodesOfSameLevel) {
            nodesOfSameLevel = this.rootNode.getNodesOfLevel(this.level) as InternalNode[];
        }

        const other = findSimilarInternalNode(
            this,
            nodesOfSameLevel
        );
        if (other) {
            // console.log('applyEliminationRule() remove:' + this.id + '; other: ' + other.id);

            // keep 'other', remove 'this'

            // move own parents to other
            const ownParents = this.parents.getAll();
            const parentsWithStrictEqualBranches: NonLeafNode[] = [];
            ownParents.forEach(parent => {
                // console.log('ownParent: ' + parent.id);
                const branchKey = parent.branches.getKeyOfNode(this);
                // console.log('branchKey: ' + branchKey);
                parent.branches.setBranch(branchKey, other);

                if (parent.branches.areBranchesStrictEqual()) {
                    parentsWithStrictEqualBranches.push(parent);
                }
                // remove parents from own list
                // this will auto-remove the connection to the other '1'-branch
                this.parents.remove(parent);
            });

            // parents that now have equal branches, must be removed again
            parentsWithStrictEqualBranches.forEach(node => {
                if (node.isInternalNode()) {
                    // console.log('trigger applyReductionRule from applyEliminationRule');
                    (node as InternalNode).applyReductionRule();
                }
            });

            return true;
        } else {
            return false;
        }
    }


}

/**
 * find an simliar node in a list of nodes
 * which is not exactly the same node
 * @hotpath
 */
export function findSimilarInternalNode(
    own: InternalNode,
    others: InternalNode[]
): InternalNode | null {
    const ownString = own.toString();
    for (let i = 0; i < others.length; i++) {
        const other = others[i];
        if (
            own !== other &&
            !other.deleted &&
            own.isEqualToOtherNode(
                other,
                ownString
            )
        ) {
            return other;
        }
    }
    return null;
}
