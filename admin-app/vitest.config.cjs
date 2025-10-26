const path = require("path");

module.exports = {
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setupActShim.ts", "./tests/setupTests.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      "server-only": path.resolve(__dirname, "tests/__mocks__/server-only.ts"),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
    loader: "tsx",
  },
};
