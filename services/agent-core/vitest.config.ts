import { defineConfig, mergeConfig } from 'vitest/config';
import { nodeConfig } from '../../vitest.shared';
import path from 'path';

export default mergeConfig(nodeConfig, defineConfig({
  test: {
    root: __dirname,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}));
