import { LeafNode } from './leaf-node';
import { InternalNode } from './internal-node';
import { RootNode } from './root-node';

export type NodeType = 'LeafNode' | 'InternalNode' | 'RootNode';

export type NonLeafNode = InternalNode | RootNode;
export type NonRootNode = InternalNode | LeafNode;

// maps state-set to value
export type TruthTable = Map<string, number>;

export type BooleanString = '0' | '1';

export type ResolverFunction<T> = (i: T) => boolean;

export type ResolverFunctions<T = any> = {
    [k: number]: ResolverFunction<T>;
};




// 1 char which is the value
export type SimpleBddLeafNode = number;

export interface SimpleBddInternalNode {
    0: SimpleBddInternalNode | SimpleBddLeafNode; // branch-0
    1: SimpleBddInternalNode | SimpleBddLeafNode; // branch-1
    l: number; // level of the boolean function
}

export type SimpleBddNode = SimpleBddLeafNode | SimpleBddInternalNode;

/**
 * a simple bdd is a json-representation
 * which could be parsed from the minimal string
 * use this to have great performance
 * when resolving values
 */
export type SimpleBdd = {
    0: SimpleBddInternalNode | SimpleBddLeafNode; // branch-0
    1: SimpleBddInternalNode | SimpleBddLeafNode; // branch-1
    l: 0; // root node always has level 0
}
