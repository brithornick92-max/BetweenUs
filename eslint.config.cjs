const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs'],
        },
      },
    },
    rules: {
      'import/namespace': 'off',
      'react/no-unescaped-entities': 'off',
    },
    ignores: [
      'android/**',
      'ios/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'output/**',
      '.expo/**',
      'node_modules/**',
    ],
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
      },
    },
  },
  {
    files: ['__tests__/**/*.js', '__tests__/**/*.jsx', 'jest.setup.cjs'],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
        test: 'readonly',
      },
    },
  },
]);