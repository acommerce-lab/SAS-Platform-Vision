import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // ─── Errors ──────────────────────────────────────────────────
      'no-console': 'error',           // Use logger, not console
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',

      // ─── Code Quality ────────────────────────────────────────────
      'eqeqeq': ['error', 'always'],
      'no-throw-literal': 'error',
      'no-return-await': 'error',
      'require-await': 'error',
      'no-duplicate-imports': 'error',

      // ─── Style ───────────────────────────────────────────────────
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'always-multiline'],
      'object-curly-spacing': ['error', 'always'],
      'arrow-body-style': ['error', 'as-needed'],
      'no-multiple-empty-lines': ['error', { max: 1 }],
      'eol-last': ['error', 'always'],
    },
  },
];
