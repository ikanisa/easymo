import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'test/e2e/**/*.test.ts'],
    exclude: [
      "tests/agent-database-architecture.test.ts",
      "tests/deeplink/**",
      "tests/waiter/**",
      "tests/voice/**",
      "tests/verify_agents.test.ts",
    ],
    reporters: "default",
  },
  resolve: {
    alias: {
      '@easymo/types': resolve(__dirname, 'packages/types/src/index.ts'),
      "@insure/ocr-extract": resolve(__dirname, "packages/ocr-extract/src/index.ts"),
      '@easymo/commons': resolve(__dirname, 'packages/commons/src/index.ts'),
    },
  },
});
