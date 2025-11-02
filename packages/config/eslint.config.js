import { createStrictConfig } from "./eslint/eslint.config.js";

export default createStrictConfig({
  targetGlobs: ["**/*.ts"],
  typedGlobs: ["**/*.ts"],
  projectConfigs: ["./tsconfig.json"],
});
