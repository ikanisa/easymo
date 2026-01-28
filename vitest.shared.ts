import react from '@vitejs/plugin-react';
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Base Vitest configuration for all packages
 * Import and extend in individual package vitest.config.ts
 */
export const baseConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.archive/**', '**/admin-app-v2/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts',
        '**/__mocks__/**',
      ],
      thresholds: {
        global: {
          statements: 70,
          branches: 70,
          functions: 70,
          lines: 70,
        },
      },
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test-results/junit.xml',
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
});

/**
 * React-specific configuration for frontend packages
 */
export const reactConfig = mergeConfig(baseConfig, {
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});

/**
 * Node-specific configuration for backend services
 */
export const nodeConfig = mergeConfig(baseConfig, {
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
  },
});
