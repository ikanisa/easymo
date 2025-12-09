import { createEslintConfig } from "../../config/tooling/eslint/factory.mjs";

export default createEslintConfig({
  ignores: ["node_modules/**", "dist/**", "build/**", "coverage/**"],
  globalTargets: ["node"],
  jsx: false,
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "prettier/prettier": "error",
  },
});
