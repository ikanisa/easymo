import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(rootDir, 'admin-app'),
    },
  },
  test: {
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'tests/deeplink/**/*.{test,spec}.{ts,tsx}',
      'tests/api/**/*.{test,spec}.{ts,tsx}',
      'admin-app/tests/**/*.{test,spec}.{ts,tsx}',
    ],
    environment: 'jsdom',
  },
});
