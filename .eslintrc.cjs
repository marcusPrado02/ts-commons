module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: true,
  },
  plugins: ['@typescript-eslint', 'deprecation'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/strict-boolean-expressions': 'error',
    '@typescript-eslint/prefer-readonly': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'error',
    '@typescript-eslint/prefer-optional-chain': 'error',
    '@typescript-eslint/no-unnecessary-condition': 'error',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/consistent-type-exports': 'error',
    '@typescript-eslint/no-import-type-side-effects': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    'complexity': ['error', { max: 10 }],
    'max-depth': ['error', { max: 4 }],
    'max-lines-per-function': ['warn', { max: 50 }],
    'deprecation/deprecation': 'error'
  },
  overrides: [
    {
      // All packages use rootDir: ./src so test files are excluded from tsconfig.json.
      // plugin:@typescript-eslint/disable-type-checked turns off every type-aware rule
      // from recommended-type-checked so project: null doesn't cause errors.
      files: ['packages/*/tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      extends: ['plugin:@typescript-eslint/disable-type-checked'],
      parserOptions: {
        project: null,
      },
      rules: {
        'max-lines-per-function': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        'complexity': ['warn', { max: 15 }],
        'no-console': 'off',
      },
    },
    {
      files: ['**/src/logging/**/*.ts'],
      rules: {
        'no-console': 'off'
      }
    }
  ],
  ignorePatterns: ['dist', 'build', 'node_modules', '*.cjs', 'vitest.config.ts', 'vitest.*.config.ts', '*.js'],
};
