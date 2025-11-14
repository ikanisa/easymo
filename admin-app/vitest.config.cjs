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
      "@va/shared": path.resolve(__dirname, "../packages/shared/src/index.ts"),
      "@va/shared/*": path.resolve(__dirname, "../packages/shared/src/*"),
      "@easymo/ui": path.resolve(__dirname, "../packages/ui/src/index.ts"),
      "@easymo/ui/*": path.resolve(__dirname, "../packages/ui/src/*"),
      "@easymo/ui/tokens": path.resolve(__dirname, "../packages/ui/tokens/index.ts"),
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
