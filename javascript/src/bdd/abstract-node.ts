import { nextNodeId } from './util';
import { NonRootNode, NonLeafNode } from './types';
import { Branches } from './branches';
import { RootNode } from './root-node';
import { InternalNode } from './internal-node';

export class AbstractNode {
    readonly id: string = nextNodeId();
    public deleted: boolean = false;
    public type: string;
    public rootNode: RootNode;

    constructor(
        readonly level: number,
        rootNode: RootNode | null,
        type: string
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
        this.ensureNotDeleted();

        console.log('AbstractNode().remove() node: ' + this.id);
        console.log(this.toJSON(true));

        if (this.isInternalNode()) {
            const useNode: InternalNode = this as any;
            if (useNode.parents.size > 0) {
                throw new Error('cannot remove node with parents ' + this.id);
            }
        }

        if (this['branches']) {
            const useNode: NonLeafNode = this as any;
            useNode.branches.getBranch('0').parents.remove(useNode);
            useNode.branches.getBranch('1').parents.remove(useNode);
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
        if (this['value']) {
            ret.value = this['value'];
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
        if (this['value']) {
            ret += '|v:' + this['value'];
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

    ensureNotDeleted(op: string = '') {
        if (this.deleted) {
            throw new Error('forbidden operation ' + op + ' on deleted node ' + this.id);
        }
    }

    public log() {
        console.log(JSON.stringify(this.toJSON(true), null, 2));
    }
}
