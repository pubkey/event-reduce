import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
    {
        ignores: [
            'dist/**',
            'node_modules/**'
        ]
    },
    {
        files: [
            '**/*.ts'
        ],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname
            }
        },
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            '@stylistic': stylistic
        },
        rules: {
            'arrow-body-style': ['error', 'as-needed'],
            'constructor-super': 'error',
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-caller': 'error',
            'no-console': ['error', {
                allow: ['log', 'warn', 'error', 'dir', 'table', 'assert', 'count', 'group', 'groupEnd']
            }],
            'no-debugger': 'error',
            'no-eval': 'error',
            'no-fallthrough': 'error',
            'no-new-wrappers': 'error',
            'no-undef-init': 'error',
            'no-unused-labels': 'error',
            'no-var': 'error',
            'prefer-const': 'error',
            'radix': 'error',

            '@typescript-eslint/member-ordering': ['error', {
                default: ['static-field', 'instance-field', 'static-method', 'instance-method']
            }],
            '@typescript-eslint/naming-convention': ['error', {
                selector: 'class',
                format: ['PascalCase']
            }],
            '@typescript-eslint/no-deprecated': 'warn',
            '@typescript-eslint/no-empty-object-type': 'error',
            '@typescript-eslint/no-misused-new': 'error',
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/no-shadow': 'error',
            '@typescript-eslint/no-unused-expressions': 'error',
            '@typescript-eslint/only-throw-error': 'error',
            '@typescript-eslint/prefer-function-type': 'error',
            '@typescript-eslint/unified-signatures': 'error',

            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/comma-spacing': 'error',
            '@stylistic/eol-last': 'error',
            '@stylistic/keyword-spacing': 'error',
            '@stylistic/max-len': ['error', { code: 160 }],
            '@stylistic/no-mixed-spaces-and-tabs': 'error',
            '@stylistic/no-tabs': 'error',
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/quotes': ['error', 'single', { avoidEscape: true }],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/spaced-comment': ['error', 'always'],
            '@stylistic/type-annotation-spacing': 'error'
        }
    }
);
