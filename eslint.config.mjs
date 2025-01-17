// @ts-nocheck
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    files: ['**/*.{js,ts}'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      eslintConfigPrettier,
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      parser: tseslint.parser,
      parserOptions: {
        project: true,
      },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'pnpm-lock.yaml',
      'lib/**',
      'cache/**',
      'cache_hardhat/**',
      'cache_hardhat-zk/**',
      'artifacts/**',
      'artifacts-zk/**',
      'typechain-types/**',
      'coverage/**',
      'deployments/**',
      'deployments-zk/**',
      'deployments_tenderly/**',
      'forge-artifacts/**',
      'bin/**',
      'out/**',
    ],
  },
)
