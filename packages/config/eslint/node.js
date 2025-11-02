import globals from "globals";
import baseConfig from "./base.js";

const nodeConfig = [
  ...baseConfig,
  {
    files: ["**/*.{js,ts}", "**/*.{cjs,mjs}", "**/*.mts", "**/*.cts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    files: ["**/*.test.{js,ts}", "**/*.spec.{js,ts}", "tests/**/*.{js,ts}"],
    rules: {
      "no-console": "off",
    },
  },
];

export default nodeConfig;
