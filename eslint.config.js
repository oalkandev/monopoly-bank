import reactHooks from 'eslint-plugin-react-hooks';

export default [
  {
    files: ['client/src/**/*.{js,jsx}', 'server/**/*.js', 'electron/**/*.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
