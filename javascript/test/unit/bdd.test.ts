import * as assert from 'assert';
import {
    randomString, randomBoolean
} from 'async-test-util';
import {
    TruthTable,
    createBddFromTruthTable
} from '../../src/bdd';
import { InternalNode, findSimilarInternalNode } from '../../src/bdd/internal-node';
import {
    decimalToPaddedBinary, maxBinaryWithLength, binaryToDecimal
} from '../../src/logic-generator/binary-state';
import { LeafNode } from '../../src/bdd/leaf-node';

describe('bdd.test.ts', () => {
    function exampleTruthTable(
        stateLength: number = 3
    ): TruthTable {
        const ret: TruthTable = new Map();
        const maxBin = maxBinaryWithLength(stateLength);
        const maxDecimal = binaryToDecimal(maxBin);

        const end = maxDecimal;
        let start = 0;
        while (start <= end) {
            ret.set(
                decimalToPaddedBinary(start, stateLength),
                'val_' + randomString(2)
            );
            start++;
        }
        return ret;
    }
    function allEqualTable(
        stateLength: number = 3
    ): TruthTable {
        const table = exampleTruthTable(stateLength);
        const keys = Array.from(table.keys());
        keys.forEach(k => table.set(k, 'a'));
        return table;
    }
    function randomTable(
        stateLength: number = 3
    ): TruthTable {
        const table = exampleTruthTable(stateLength);
        const keys = Array.from(table.keys());
        keys.forEach(k => {
            // 'b' is more often then 'a'
            const val = (randomBoolean() && randomBoolean()) ? 'a' : 'b';
            table.set(k, val);
        });
        return table;
    }
    describe('createBddFromTruthTable()', () => {
        it('should create a bdd', () => {
            const bdd = createBddFromTruthTable(
                exampleTruthTable()
            );
            assert.ok(bdd);
        });
    });
    describe('equalBranches()', () => {
        it('should be false', () => {
            const bdd = createBddFromTruthTable(
                exampleTruthTable()
            );
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;
            const equal = first.hasEqualBranches();
            assert.strictEqual(equal, false);
        });
        it('should be true', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;
            const equal = first.hasEqualBranches();
            assert.ok(equal);
        });
    });
    describe('findSimilarInternalNode()', () => {
        it('should be equal to equal node of other bdd', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;

            const bdd2 = createBddFromTruthTable(table);
            const nodes2 = bdd2.getNodesOfLevel(1);
            const first2: InternalNode = nodes2.values().next().value;

            const found = findSimilarInternalNode(
                first,
                [first2]
            );
            assert.ok(found);
        });
        it('should not find itself', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;

            const found = findSimilarInternalNode(
                first,
                [first]
            );
            assert.strictEqual(found, null);
        });

        it('should be not be equal to root node', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;

            const found = findSimilarInternalNode(
                first,
                [bdd as any]
            );
            assert.strictEqual(found, null);
        });
    });

    describe('applyReductionRule()', () => {
        it('should remove itself', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(2);
            const first: InternalNode = nodes.values().next().value;
            first.applyReductionRule();
            assert.ok(
                (bdd as any).branches['0'].branches['0'].isLeafNode()
            );
        });
    });
    describe('applyEliminationRule()', () => {
        it('should remove the found one', () => {
            console.log('###########################');
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes[0] as InternalNode;
            first.applyEliminationRule();

            bdd.log();

            assert.strictEqual(
                (bdd.branches['0'] as InternalNode).id,
                (bdd.branches['1'] as InternalNode).id,
            );
        });
    });
    describe('minimize()', () => {
        it('should return a minimized version', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            assert.ok((bdd as any).branches['0'].isLeafNode());
            assert.ok((bdd as any).branches['1'].isLeafNode());
        });
        it('should not crash on random table', () => {
            const table = exampleTruthTable();
            table.set('000', 'a');
            table.set('001', 'a');
            table.set('010', 'a');
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            assert.ok((bdd as any).branches['0'].branches['0'].isLeafNode());
        });
        it('random table should not have to equal branches', () => {
            const depth = 9;
            const table = randomTable(depth);
            const bdd = createBddFromTruthTable(table);
            bdd.minimize();
            // bdd.log();
            const leafNodes: LeafNode[] = bdd.getNodesOfLevel(depth) as LeafNode[];
            leafNodes.forEach(leaf => {
                const parent: InternalNode = leaf.parent as InternalNode;
                // console.log('nnnn: ');
                // console.log(JSON.stringify(parent.toJSON(true), null, 2));
                assert.notStrictEqual(
                    (parent.branches['0'] as LeafNode).value,
                    (parent.branches['1'] as LeafNode).value
                );
            });
        });
    });
    describe('countNodes()', () => {
        it('should be smaller after minimize', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const before = bdd.countNodes();
            bdd.minimize();
            const after = bdd.countNodes();
            assert.ok(before > after);
        });
    });

});
