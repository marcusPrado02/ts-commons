module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: [
      './tsconfig.json',
      './packages/*/tsconfig.json',
    ],
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
      files: ['**/*.test.ts', '**/*.spec.ts'],
      rules: {
        'max-lines-per-function': ['warn', { max: 100 }],
        '@typescript-eslint/no-unsafe-member-access': 'off',
        'complexity': ['warn', { max: 15 }]
      }
    },
    {
      files: ['**/src/logging/**/*.ts'],
      rules: {
        'no-console': 'off'
      }
    }
  ],
  ignorePatterns: ['dist', 'build', 'node_modules', '*.cjs', 'vitest.config.ts'],
};
