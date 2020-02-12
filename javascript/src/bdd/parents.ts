import {
    NonLeafNode,
    NonRootNode
} from './types';

/**
 * represents the parents of a single node
 */
export class Parents {

    private parents: Set<NonLeafNode> = new Set();

    constructor(
        public node: NonRootNode
    ) { }

    public remove(node: NonLeafNode) {
        this.parents.delete(node);

        if (this.parents.size === 0) {
            this.node.remove();
        }
    }

    public getAll(): NonLeafNode[] {
        return Array.from(this.parents);
    }

    public add(node: NonLeafNode) {
        if (this.node.level === node.level) {
            throw new Error('a node cannot be parent of a node with the same level');
        }
        this.parents.add(node);
    }

    public has(node: NonLeafNode){
        return this.parents.has(node);
    }

    toString() {
        const ret: string[] = [];
        for (const parent of this.parents) {
            ret.push(parent.id);
        }
        return ret.join(', ');
    }

    get size(): number {
        return this.parents.size;
    }
}
