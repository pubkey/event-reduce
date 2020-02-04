import { Branches, BddNode, NonRootNode } from './types';
import { nextNodeId } from './util';

export class RootNode implements BddNode {
    public type: string = 'RootNode';
    public id: string = nextNodeId();
    public level: number = 0;
    public branches: Branches = {};

    private levels: Set<number> = new Set();
    private nodesByLevel: Map<number, Set<NonRootNode>> = new Map();

    constructor(
    ) { }

    addNode(node: NonRootNode) {
        const level = node.level;
        this.levels.add(level);
        this.ensureLevelSetExists(level);
        const set = this.nodesByLevel.get(level);
        set?.add(node);
    }

    removeNode(node: NonRootNode) {
        const set = this.nodesByLevel.get(node.level) as Set<NonRootNode>;
        set.delete(node);
    }

    private ensureLevelSetExists(level: number) {
        if (!this.nodesByLevel.has(level)) {
            this.nodesByLevel.set(level, new Set());
        }
    }

    getLevels(): number[] {
        return Array.from(this.levels);
    }

    getNodesOfLevel(level: number): NonRootNode[] {
        this.ensureLevelSetExists(level);
        const set = this.nodesByLevel.get(level) as Set<NonRootNode>;
        return Array.from(set);
    }

    isRootNode(): boolean {
        return true;
    }
    isInternalNode(): boolean {
        return false;
    }
    isLeafNode(): boolean {
        return false;
    }

    public log() {
        console.log(JSON.stringify(this.toJSON(true), null, 2));
    }

    toJSON(withId: boolean = false): any {
        return {
            id: withId ? this.id : undefined,
            type: this.type,
            level: this.level,
            branches: {
                '0': this.branches['0'] ? this.branches['0'].toJSON(withId) : undefined,
                '1': this.branches['1'] ? this.branches['1'].toJSON(withId) : undefined
            }
        };
    }
}
