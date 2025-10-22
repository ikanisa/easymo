const path = require('path');

module.exports = {
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setupTests.ts'],
    include: ['tests/smoke.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
      'server-only': path.resolve(__dirname, 'tests/__mocks__/server-only.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
    loader: 'tsx',
  },
};
