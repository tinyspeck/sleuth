module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
  ],
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs}', './tools/**/*.js'],
      parserOptions: {
        sourceType: 'script',
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      },
    },
    // Temporary override to detect usage of Node.js APIs in the renderer process
    {
      files: ['src/renderer/**/*.{js,ts,jsx,tsx}'],
      env: {
        browser: true,
        node: false,
      },
      rules: {
        'no-restricted-imports': [
          'error',
          'fs',
          'fs-extra',
          'os',
          'path',
          'child_process',
          'stream',
          'util',
        ],
        'no-restricted-globals': ['error', 'process', 'require', '__dirname'],
      },
    },
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
