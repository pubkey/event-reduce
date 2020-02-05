import { LeafNode } from './leaf-node';
import { InternalNode } from './internal-node';
import { RootNode } from './root-node';

export type Branch = InternalNode | LeafNode;
export interface Branches {
    '1'?: NonRootNode,
    '0'?: NonRootNode
}

export interface BddNode {
    readonly id: string;
    readonly type: string;
    readonly level: number;
    deleted: boolean;
    isRootNode(): boolean;
    isInternalNode(): boolean;
    isLeafNode(): boolean;

    toJSON(withId?: boolean): any;
}

export type NonLeafNode = InternalNode | RootNode;
export type NonRootNode = InternalNode | LeafNode;

export type TruthTable = Map<string, string>;

export type BooleanString = '0' | '1';
