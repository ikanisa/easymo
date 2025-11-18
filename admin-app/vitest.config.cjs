const path = require("path");

module.exports = {
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setupActShim.ts", "./tests/setupTests.ts"],
    testTimeout: 15000,
    hookTimeout: 10000,
    coverage: {
      reporter: ["text", "json", "html"],
    },
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{git,svn,hg}/**",
      "tests/e2e/playwright/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Shared packages
      "@va/shared": path.resolve(__dirname, "../packages/shared/src/index.ts"),
      "@va/shared/*": path.resolve(__dirname, "../packages/shared/src/*"),
      // Map @easymo/ui to its source directory so deep imports like
      // "@easymo/ui/components/Button" resolve correctly in tests.
      "@easymo/ui": path.resolve(__dirname, "../packages/ui/src"),
      "@easymo/ui/tokens": path.resolve(__dirname, "../packages/ui/tokens/index.ts"),
      // Mocks
      "@easymo/commons": path.resolve(__dirname, "tests/__mocks__/commons-logger.ts"),
      "@easymo/commons/*": path.resolve(__dirname, "tests/__mocks__/commons-logger.ts"),
      "server-only": path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
    loader: "tsx",
  },
};
