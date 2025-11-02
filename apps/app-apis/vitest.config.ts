import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
    },
  },
  resolve: {
    alias: [
      { find: "@app-apis/tests", replacement: resolve(__dirname, "tests") },
      { find: "@app-apis/tests/", replacement: `${resolve(__dirname, "tests")}/` },
      { find: "@app-apis", replacement: resolve(__dirname, "src") },
      { find: "@app-apis/", replacement: `${resolve(__dirname, "src")}/` },
      { find: "@easymo/clients", replacement: resolve(__dirname, "../../packages/clients/src") },
      {
        find: "@easymo/clients/",
        replacement: `${resolve(__dirname, "../../packages/clients/src")}/`,
      },
    ],
  },
});
