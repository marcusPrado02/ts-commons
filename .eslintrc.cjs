module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: true,
  },
  plugins: ['@typescript-eslint'],
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
    'max-lines-per-function': ['warn', { max: 50 }]
  },
  overrides: [
    {
      // All packages use rootDir: ./src so test files are excluded from tsconfig.json.
      // Disable type-aware linting for all test files — the rules below cover what matters.
      files: ['packages/*/tests/**/*.ts', '**/*.test.ts', '**/*.spec.ts'],
      parserOptions: {
        project: null,
      },
      rules: {
        // Type-aware rules that require a tsconfig program — disabled since project: null
        '@typescript-eslint/no-floating-promises': 'off',
        '@typescript-eslint/await-thenable': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/require-await': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/strict-boolean-expressions': 'off',
        '@typescript-eslint/prefer-readonly': 'off',
        '@typescript-eslint/prefer-nullish-coalescing': 'off',
        '@typescript-eslint/prefer-optional-chain': 'off',
        '@typescript-eslint/no-unnecessary-condition': 'off',
        '@typescript-eslint/switch-exhaustiveness-check': 'off',
        // Relaxed rules for tests
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
