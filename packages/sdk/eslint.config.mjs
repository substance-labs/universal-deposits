import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'bin/**',
      'out/**',
      'lib/**',
      'cache/**',
      'coverage/**',
      'artifacts/**',
      'node_modules/**',
      'cache_hardhat/**',
      'typechain-types/**',
      'forge-artifacts/**',
      'pnpm-lock.yaml',
    ],
  },
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { plugins: { '@typescript-eslint': tseslint.plugin } },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
]
