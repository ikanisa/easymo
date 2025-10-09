const path = require("path");

module.exports = {
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setupTests.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
    loader: "tsx",
  },
};
