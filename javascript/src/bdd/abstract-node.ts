import { nextNodeId } from './util';
import { NonRootNode, NonLeafNode, NodeType } from './types';
import { Branches } from './branches';
import { RootNode } from './root-node';
import { InternalNode } from './internal-node';
import { LeafNode } from './leaf-node';
import { findSimilarNode } from './find-similar-node';

export class AbstractNode {
    readonly id: string = nextNodeId();
    public deleted: boolean = false;
    public type: NodeType;
    public rootNode: RootNode;

    constructor(
        readonly level: number,
        rootNode: RootNode | null,
        type: NodeType
    ) {
        this.type = type;

        this.rootNode = rootNode as RootNode;
        if (rootNode) {
            this.rootNode.addNode(this as any);
        }
    }

    isEqualToOtherNode(
        otherNode: NonRootNode | RootNode,
        // optimisation shortcut, is faster if own string already known
        ownString: string = this.toString()
    ): boolean {
        const ret = ownString === otherNode.toString();
        return ret;
    }

    // deletes the whole node
    public remove() {
        this.ensureNotDeleted('remove');

        // console.log('AbstractNode().remove() node: ' + this.id);
        // console.log(this.toJSON(true));

        if (this.isInternalNode()) {
            const useNode: InternalNode = this as any;
            if (useNode.parents.size > 0) {
                throw new Error('cannot remove node with parents ' + this.id);
            }
        }

        if (this['branches']) {
            const useNode: NonLeafNode = this as any;
            if (useNode.branches.areBranchesStrictEqual()) {
                useNode.branches.getBranch('0').parents.remove(useNode);
            } else {
                useNode.branches.getBranch('0').parents.remove(useNode);
                useNode.branches.getBranch('1').parents.remove(useNode);
            }
        }

        this.deleted = true;
        this.rootNode.removeNode(this as any);
    }

    toJSON(withId: boolean = false): any {
        const ret: any = {
            id: withId ? this.id : undefined,
            deleted: withId ? this.deleted : undefined,
            type: this.type,
            level: this.level
        };

        if (withId && this['parents']) {
            ret.parents = this['parents'].toString();
        }
        if (this.isLeafNode()) {
            ret.value = this.asLeafNode().value;
        }
        if (this['branches'] && !this['branches'].deleted) {
            const branches: Branches = this['branches'];
            ret.branches = {
                '0': branches.getBranch('0').toJSON(withId),
                '1': branches.getBranch('1').toJSON(withId)
            };
        }

        return ret;
    }


    // a strange string-representation
    // to make an equal check between nodes
    toString(): string {
        let ret = '' +
            '<' +
            this.type + ':' + this.level;

        if (this['branches']) {
            const branches: Branches = this['branches'];
            ret += '|0:' + branches.getBranch('0');
            ret += '|1:' + branches.getBranch('1');
        }
        if (this.isLeafNode()) {
            ret += '|v:' + this.asLeafNode().value;
        }
        ret += '>';
        return ret;
    }


    isRootNode(): boolean {
        return this.type === 'RootNode';
    }
    isInternalNode(): boolean {
        return this.type === 'InternalNode';
    }
    isLeafNode(): boolean {
        return this.type === 'LeafNode';
    }

    asRootNode(): RootNode {
        if (!this.isRootNode()) {
            throw new Error('ouch');
        }
        return this as any;
    }
    asInternalNode(): InternalNode {
        if (!this.isInternalNode()) {
            throw new Error('ouch');
        }
        return this as any;
    }
    asLeafNode(): LeafNode {
        if (!this.isLeafNode()) {
            throw new Error('ouch');
        }
        return this as any;
    }

    ensureNotDeleted(op: string = 'unknown') {
        if (this.deleted) {
            throw new Error('forbidden operation ' + op + ' on deleted node ' + this.id);
        }
    }

    public log() {
        console.log(JSON.stringify(this.toJSON(true), null, 2));
    }

    /**
 * by the elimination-rule of bdd,
 * if two branches of the same level are equal,
 * one can be removed
 *
 * See page 21 at:
 * @link https://people.eecs.berkeley.edu/~sseshia/219c/lectures/BinaryDecisionDiagrams.pdf
 */
    applyEliminationRule<T extends AbstractNode>(
        // can be provided for better performance
        nodesOfSameLevel?: T[]
    ): boolean {
        this.ensureNotDeleted('applyEliminationRule');
        if (!nodesOfSameLevel) {
            nodesOfSameLevel = this.rootNode.getNodesOfLevel(this.level) as any[];
        }

        const other = findSimilarNode(
            this,
            nodesOfSameLevel as any[]
        );
        if (other) {
            // console.log('applyEliminationRule() remove:' + this.id + '; other: ' + other.id);

            // keep 'other', remove 'this'

            // move own parents to other
            const ownParents = (this as any).parents.getAll();
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
                (this as any).parents.remove(parent);
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
