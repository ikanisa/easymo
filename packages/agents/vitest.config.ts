/**
 * Vitest configuration for agents package
 */

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.config.ts',
        '**/setup.ts',
        '**/mocks/**',
        '**/test-helpers.ts',
        // Exclude index files (re-exports only)
        '**/index.ts',
        // Exclude validation scripts
        '**/validate-*.mjs',
        '**/validate-*.ts',
        // Exclude type definition files
        '**/types/*.ts',
        // Exclude experimental features
        '**/openai_realtime.ts',
        // Exclude scripts
        '**/scriptPlanner.ts',
        // Exclude the service catalog (static config)
        '**/service-catalog.ts',
        // Exclude runner (orchestration layer that requires integration testing)
        '**/runner.ts',
        // Exclude deprecated/merged agents
        '**/business-broker.agent.ts',
        // Exclude vectorSearch execution (requires external APIs)
        '**/vectorSearch.ts',
      ],
      thresholds: {
        global: {
          branches: 65,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
    },
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@easymo/commons': path.resolve(__dirname, 'src/__tests__/mocks/commons.mock.ts'),
    },
  },
});
