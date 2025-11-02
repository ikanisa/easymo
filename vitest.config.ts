import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(rootDir, 'admin-app'),
      '@station': resolve(rootDir, 'station-app/src'),
      '@va/shared': resolve(rootDir, 'packages/shared/src/index.ts'),
      'server-only': resolve(rootDir, 'tests/stubs/server-only.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/deeplink/**/*.{test,spec}.{ts,tsx}',
      'tests/api/**/*.{test,spec}.{ts,tsx}',
      'station-app/tests/**/*.{test,spec}.{ts,tsx}',
      'packages/utils/log/src/**/*.{test,spec}.{ts,tsx}',
    ],
    environment: 'jsdom',
    setupFiles: ['admin-app/tests/setupTests.ts'],
  },
});
