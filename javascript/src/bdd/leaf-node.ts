import { BddNode, NonLeafNode } from './types';
import { nextNodeId } from './util';
import { RootNode } from './root-node';

export class LeafNode implements BddNode {
    readonly type: string = 'LeafNode';
    readonly id: string = nextNodeId();
    public deleted: boolean = false;

    constructor(
        readonly level: number,
        public value: string,
        public parent: NonLeafNode,
        private rootNode: RootNode
    ) {
        this.rootNode.addNode(this);
    }

    isRootNode(): boolean {
        return false;
    }
    isInternalNode(): boolean {
        return false;
    }
    isLeafNode(): boolean {
        return true;
    }

    removeDeep() {
        this.deleted = true;
        this.rootNode.removeNode(this);
    }

    toJSON(withId: boolean = false): any {
        return {
            id: withId ? this.id : undefined,
            parent: withId ? this.parent.id : undefined,
            type: this.type,
            level: this.level,
            value: this.value
        };
    }
}
