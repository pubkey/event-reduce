import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { parse } from 'acorn';
import { full } from 'acorn-walk';

/**
 * The library is published as ES5, so that bundles which must stay ES5
 * (like the ES5 build of Dexie.js) can include it without transpiling it.
 */
const ES2015_NODE_TYPES = new Set([
    'ArrowFunctionExpression',
    'ClassDeclaration',
    'ClassExpression',
    'TemplateLiteral',
    'TaggedTemplateExpression',
    'SpreadElement',
    'RestElement',
    'ForOfStatement',
    'ObjectPattern',
    'ArrayPattern',
    'AssignmentPattern',
    'AwaitExpression',
    'YieldExpression',
    'MetaProperty'
]);

function jsFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return jsFiles(file);
        }
        return file.endsWith('.js') ? [file] : [];
    });
}

describe('es5.test.ts', () => {
    // compiled to dist/cjs/test/unit
    const cjsDir = path.join(__dirname, '..', '..', 'src');
    const esmDir = path.join(__dirname, '..', '..', '..', 'esm', 'src');

    it('the CommonJS build should only contain ES5 syntax', () => {
        const files = jsFiles(cjsDir);
        assert.ok(files.length > 0);
        files.forEach(file => {
            try {
                parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 5 });
            } catch (err) {
                throw new Error(path.relative(cjsDir, file) + ' is not ES5: ' + (err as Error).message);
            }
        });
    });
    it('the ES module build should be importable as an ES module', () => {
        // Also imports the ES module build of binary-decision-diagram.
        const output = execFileSync(process.execPath, [
            '--input-type=module',
            '-e',
            'const m = await import(' + JSON.stringify('file://' + path.join(esmDir, 'index.js')) + ');' +
            'console.log(typeof m.calculateActionFunction + typeof m.applyChangeEventsToResultWindowBuffer);'
        ], { cwd: path.join(__dirname, '..', '..', '..', '..') }).toString().trim();
        assert.strictEqual(output, 'functionfunction');
    });
    it('the CommonJS build should be requireable', () => {
        const m = require(path.join(cjsDir, 'index.es5.js'));
        assert.strictEqual(typeof m.calculateActionFunction, 'function');
        assert.strictEqual(typeof m.applyChangeEventsToResultWindowBuffer, 'function');
    });
    it('the ES module build should only contain ES5 syntax besides import and export', () => {
        const files = jsFiles(esmDir);
        assert.ok(files.length > 0);
        files.forEach(file => {
            const ast = parse(fs.readFileSync(file, 'utf8'), { ecmaVersion: 2015, sourceType: 'module', locations: true });
            full(ast, (node: any) => {
                const isES2015 = ES2015_NODE_TYPES.has(node.type) ||
                    (node.type === 'VariableDeclaration' && node.kind !== 'var') ||
                    (node.type === 'Property' && (node.shorthand || node.method || node.computed)) ||
                    ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && (node.generator || node.async));
                if (isES2015) {
                    throw new Error(path.relative(esmDir, file) + ':' + node.loc.start.line + ' is not ES5: ' + node.type);
                }
            });
        });
    });
});
