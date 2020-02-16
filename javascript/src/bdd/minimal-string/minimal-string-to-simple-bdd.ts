import {
    SimpleBdd,
    SimpleBddLeafNode,
    SimpleBddInternalNode,
    SimpleBddNode
} from '../types';
import { splitStringToChunks } from '../util';
import { getNumberOfChar } from './string-format';

export function minimalStringToSimpleBdd(
    str: string
): SimpleBdd {
    const nodesById: Map<string, SimpleBddNode> = new Map();

    // parse leaf nodes
    const leafNodeAmount = parseInt(str.charAt(0) + str.charAt(1), 10);
    const lastLeafNodeChar = (2 + leafNodeAmount * 2);
    const leafNodeChars = str.substring(2, lastLeafNodeChar);
    const leafNodeChunks = splitStringToChunks(leafNodeChars, 2);
    for (let i = 0; i < leafNodeChunks.length; i++) {
        const chunk = leafNodeChunks[i];
        const id = chunk.charAt(0);
        const value: SimpleBddLeafNode = getNumberOfChar(chunk.charAt(1));
        nodesById.set(id, value);
    }

    // parse internal nodes
    const internalNodeChars = str.substring(lastLeafNodeChar, str.length - 2);
    const internalNodeChunks = splitStringToChunks(internalNodeChars, 4);
    for (let i = 0; i < internalNodeChunks.length; i++) {
        const chunk = internalNodeChunks[i];
        const id = chunk.charAt(0);
        const idOf0Branch = chunk.charAt(1);
        const idOf1Branch = chunk.charAt(2);
        const level = getNumberOfChar(chunk.charAt(3));
        const node0 = nodesById.get(idOf0Branch) as SimpleBddNode;
        const node1 = nodesById.get(idOf1Branch) as SimpleBddNode;
        const node: SimpleBddInternalNode = {
            0: node0,
            1: node1,
            l: level
        };
        nodesById.set(id, node);
    }

    // parse root node
    const last2 = str.slice(-2);
    const idOf0 = last2.charAt(0);
    const idOf1 = last2.charAt(1);
    const nodeOf0 = nodesById.get(idOf0) as SimpleBddNode;
    const nodeOf1 = nodesById.get(idOf1) as SimpleBddNode;
    const rootNode: SimpleBdd = {
        0: nodeOf0,
        1: nodeOf1,
        l: 0
    };

    return rootNode;
}
