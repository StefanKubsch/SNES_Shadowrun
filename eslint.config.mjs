// ESLint flat configuration: the recommended JavaScript rules for all project
// modules. Formatting stays with Prettier; generated data and archives are skipped.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'analysis/',
      'assets/',
      'Ressources/',
      'docs/handoff-archiv/',
      '.cache/',
      'node_modules/',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.worker,
        ...globals.audioWorklet,
        ...globals.node,
      },
    },
    // A rest destructuring may drop named fields on purpose ({ handled, ...rest }).
    rules: { 'no-unused-vars': ['error', { ignoreRestSiblings: true }] },
  },
];
