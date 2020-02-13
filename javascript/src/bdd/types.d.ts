import { LeafNode } from './leaf-node';
import { InternalNode } from './internal-node';
import { RootNode } from './root-node';

export type NonLeafNode = InternalNode | RootNode;
export type NonRootNode = InternalNode | LeafNode;

export type TruthTable = Map<string, string>;

export type BooleanString = '0' | '1';

export type ResolverFunction<T> = (i: T) => boolean;

export type ResolverFunctions<T = any> = {
    [k: number]: ResolverFunction<T>;
};

export type SmallBddRepresentation = {

}
