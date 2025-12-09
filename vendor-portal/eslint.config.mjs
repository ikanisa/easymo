import reactHooks from "eslint-plugin-react-hooks";

import { createEslintConfig } from "../../../config/tooling/eslint/factory.mjs";
import {
  sharedReactRules,
  structuredLoggingRules,
} from "../../../config/tooling/eslint/shared-rules.mjs";

const adminConfig = createEslintConfig({
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "android/app/src/main/assets/**",
    "public/**",
    "scripts/**",
    "tests/**",
    "next-env.d.ts",
    ".tmp/**",
    "legacy/**",
    "legacy-src/**",
    "legacy-public/**",
    "../../../supabase/functions/**",
  ],
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: import.meta.dirname,
  },
  plugins: {
    "react-hooks": reactHooks,
  },
  rules: {
    ...sharedReactRules,
    ...structuredLoggingRules,
    // Disable rules that require type information during build
    // These conflict with Next.js's own TypeScript checking
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-misused-promises": "off",
    "@typescript-eslint/no-unused-vars": "off", // Conflicting with context.getScope
  },
});

export default adminConfig;
