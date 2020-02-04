import * as assert from 'assert';
import {
    TruthTable, createBddFromTruthTable
} from '../../src/bdd';
import { InternalNode } from '../../src/bdd/internal-node';

describe('bdd.test.ts', () => {
    function exampleTruthTable(): TruthTable {
        const ret: TruthTable = new Map();
        ret.set('00', 'a');
        ret.set('01', 'b');
        ret.set('10', 'c');
        ret.set('11', 'd');
        return ret;
    }

    function allEqualTable(): TruthTable {
        const ret: TruthTable = new Map();
        ret.set('00', 'a');
        ret.set('01', 'a');
        ret.set('10', 'a');
        ret.set('11', 'a');
        return ret;
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

    describe('applyReductionRule()', () => {
        it('should remove itself', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;
            first.applyReductionRule();

            assert.ok(
                (bdd.branches['0'] as any).isLeafNode()
            );

        });
    });
    describe('applyEliminationRule()', () => {
        it('should remove the found one', () => {
            const table = allEqualTable();
            const bdd = createBddFromTruthTable(table);
            const nodes = bdd.getNodesOfLevel(1);
            const first: InternalNode = nodes.values().next().value;
            first.applyEliminationRule();

            bdd.log();
            assert.strictEqual(
                (bdd.branches['0'] as InternalNode).id,
                (bdd.branches['1'] as InternalNode).id,
            );
        });
    });
});
