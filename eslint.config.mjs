// ESLint flat configuration: the recommended JavaScript rules for all project
// modules. Formatting stays with Prettier; generated data is skipped.
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['analysis/', 'assets/', 'Ressources/', '.cache/', 'dist/', 'node_modules/'],
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
  {
    // The decompiled scripts keep the original's dead stores, zeroed locals and unused
    // state parameter, and every script is a generator (tools/decompile-scripts.mjs).
    files: ['src/scripts/scripts-*.mjs'],
    rules: { 'no-unused-vars': 'off', 'no-useless-assignment': 'off', 'require-yield': 'off' },
  },
];
