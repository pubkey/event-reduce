import {
    Branches,
    BddNode,
    NonLeafNode,
    NonRootNode,
    BooleanString
} from './types';
import { nextNodeId } from './util';
import { RootNode } from './root-node';

export class InternalNode implements BddNode {
    readonly type: string = 'InternalNode';
    readonly id: string = nextNodeId();
    public branches: Branches = {};
    public deleted: boolean = false;

    constructor(
        readonly level: number,
        public parent: NonLeafNode,
        private rootNode: RootNode
    ) {
        this.rootNode.addNode(this);
    }

    isRootNode(): boolean {
        return false;
    }
    isInternalNode(): boolean {
        return true;
    }
    isLeafNode(): boolean {
        return false;
    }

    public hasEqualBranches() {
        return JSON.stringify(this.branches['0']) ===
            JSON.stringify(this.branches['1']);
    }
    isEqualToOtherNode(
        otherNode: InternalNode,
        // optimisation shortcut, is faster if own string already known
        ownString: string = this.toString()
    ): boolean {
        const ret = ownString === otherNode.toString();
        return ret;
    }

    /**
     * by the reduction-rule of bdd,
     * if both branches are equal,
     * we can remove this node from the bdd
     */
    applyReductionRule(): boolean {

        let equalObjectBranches = false;
        if (
            this.branches['0'] === this.branches['1']
        ) {
            equalObjectBranches = true;
        }


        if (this.hasEqualBranches()) {
            console.log('applyReductionRule()');

            const keepBranch: NonRootNode = this.branches['0'] as NonRootNode;

            keepBranch.parent = this.parent;
            if (this.parent.branches['0'] === this) {
                this.parent.branches['0'] = keepBranch;
            } else {
                this.parent.branches['1'] = keepBranch;
            }

            delete this.branches['0']; // delete so it does not get removed
            if (equalObjectBranches) {
                delete this.branches['1'];
            }
            this.removeDeep();

            return true;
        } else {
            return false;
        }
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
        if (!nodesOfSameLevel) {
            nodesOfSameLevel = this.rootNode.getNodesOfLevel(this.level) as InternalNode[];
        }
        const found = findSimilarInternalNode(
            this,
            nodesOfSameLevel
        );
        if (found) {
            // this.rootNode.log();
            console.log('applyEliminationRule() ' + this.id);
            console.dir(this.toJSON(true));
            console.dir(found.toJSON(true));
            console.dir(found.parent.toJSON(true));


            if (found.parent.branches['0'] === found) {
                found.parent.branches['0'] = this;
            }
            if (found.parent.branches['1'] === found) {
                found.parent.branches['1'] = this;
            }
            this.parent = found.parent;
            console.dir(this.toJSON(true));
            found.removeDeep();
            return true;
        } else {
            return false;
        }
    }



    removeDeep() {
        console.log('removeDeep() ' + this.id);
        this.deleted = true;
        this.rootNode.removeNode(this);
        console.log('remove branches');
        console.dir(this.branches['0']?.toJSON(true));
        console.log(this.branches['0']?.deleted);
        console.dir(this.branches['1']?.toJSON(true));
        console.log(this.branches['1']?.deleted);
        this.branches['0']?.removeDeep();
        this.branches['1']?.removeDeep();

        console.dir(this.branches['0']?.toJSON(true));
        console.log(this.branches['0']?.deleted);
        console.dir(this.branches['1']?.toJSON(true));
        console.log(this.branches['1']?.deleted);

    }

    toJSON(withId: boolean = false): any {
        return {
            id: withId ? this.id : undefined,
            parent: withId ? this.parent.id : undefined,
            deleted: withId ? this.deleted : undefined,
            type: this.type,
            level: this.level,
            branches: {
                '0': this.branches['0'] ? this.branches['0'].toJSON(withId) : undefined,
                '1': this.branches['1'] ? this.branches['1'].toJSON(withId) : undefined
            }
        };
    }

    branchToString(v: BooleanString) {
        if (this.branches[v]) {
            return (this.branches[v] as NonRootNode).toString();
        } else {
            return '';
        }
    }

    // a strange string-representation
    // to make an equal check between nodes
    toString(): string {
        return '' +
            '<' +
            this.type + ':' + this.level +
            '|0:' + this.branchToString('0') +
            '|1:' + this.branchToString('1') +
            '>';
    }
}