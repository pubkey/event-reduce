import { Parents } from './parents';
import { AbstractNode } from './abstract-node';
import { RootNode } from './root-node';
import { NonLeafNode } from '.';

export class LeafNode extends AbstractNode {
    public parents = new Parents(this);

    constructor(
        level: number,
        rootNode: RootNode,
        public value: string,
        parent: NonLeafNode
    ) {
        super(level, rootNode, 'LeafNode');
        this.parents.add(parent);
    }
}
