import { AbstractNode } from './abstract-node';

/**
 * find an simliar node in a list of nodes
 * which is not exactly the same node
 * @hotpath
 */
export function findSimilarNode<T extends AbstractNode>(
    own: T,
    others: T[]
): T | null {
    const ownString = own.toString();
    for (let i = 0; i < others.length; i++) {
        const other = others[i];
        if (
            own !== other &&
            !other.deleted &&
            own.isEqualToOtherNode(
                other as any,
                ownString
            )
        ) {
            return other;
        }
    }
    return null;
}
