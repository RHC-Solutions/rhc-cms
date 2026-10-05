// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
// Both come with eslint-config-next. Registered so the inline
// `eslint-disable` directives that name their rules resolve (an unknown rule
// in a directive is a lint error).
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'cms-data/**',
      'design-preview/**',
      'scripts/**',
      'functions/**',
      'src/components/ContactForm.tsx.backup',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        // Browser + Node + React globals used across this app.
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        React: 'readonly',
      },
    },
    rules: {
      // Pragmatic settings to avoid swamping the existing codebase.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-empty': 'warn',
      'no-undef': 'off', // TS handles this
      'no-useless-escape': 'off',
      'no-case-declarations': 'off',
      'no-constant-binary-expression': 'off',
      'no-useless-assignment': 'off',
      'prefer-const': 'warn',
      // Plain <img> is only used at a few intentional sites, each with an
      // explicit disable directive. This flags any other stray <img>.
      '@next/next/no-img-element': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
