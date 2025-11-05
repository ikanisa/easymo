import { createStrictConfig } from "../../config/eslint/eslint.config.js";

export default createStrictConfig({
  targetGlobs: [
    "src/**/*.ts",
    "src/**/*.tsx",
    "vitest.config.ts",
  ],
  typedGlobs: ["src/**/*.ts"],
  projectConfigs: ["./tsconfig.json"],
});
