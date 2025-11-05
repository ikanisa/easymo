import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const DEFAULT_IGNORES = [
  "**/dist/**",
  "**/.next/**",
  "**/build/**",
  "**/.turbo/**",
  "coverage/**",
  "node_modules/**",
];

const LOG_LEVELS = ["debug", "info", "warn", "error"];

/**
 * Create a strict ESLint flat config tailored for TypeScript/React projects.
 *
 * @param {object} [options]
 * @param {string} [options.tsconfigRootDir]
 * @param {string[]} [options.additionalIgnores]
 * @param {Record<string, any>} [options.customRules]
 * @param {Array<object>} [options.overrides]
 * @param {string[]} [options.targetGlobs]
 * @param {string[]} [options.typedGlobs]
 * @param {string[]} [options.projectConfigs]
 */
export function createStrictConfig(options = {}) {
  const {
    tsconfigRootDir = process.cwd(),
    additionalIgnores = [],
    customRules = {},
    overrides = [],
    targetGlobs = ["**/*.{ts,tsx,js,jsx}"],
    typedGlobs = [],
    projectConfigs = [],
  } = options;

  const baseConfig = {
    name: "easymo/strict-base",
    extends: [js.configs.recommended, ...tseslint.configs.strict, ...tseslint.configs.stylistic],
    files: targetGlobs,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-refresh/only-export-components": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": ["error", { destructuring: "all" }],
      "@typescript-eslint/array-type": ["error", { default: "array-simple" }],
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        { allowExpressions: true, allowTypedFunctionExpressions: true },
      ],
      "@typescript-eslint/explicit-member-accessibility": [
        "error",
        { overrides: { constructors: "no-public" } },
      ],
      "@typescript-eslint/method-signature-style": ["error", "property"],
      ...customRules,
    },
    settings: {
      logLevels: LOG_LEVELS,
      react: {
        version: "detect",
      },
    },
  };

  const typedConfig = typedGlobs.length
    ? {
        name: "easymo/strict-typed",
        files: typedGlobs,
        extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          parserOptions:
            projectConfigs.length > 0
              ? {
                  project: projectConfigs,
                  tsconfigRootDir,
                }
              : {
                  projectService: true,
                  tsconfigRootDir,
                },
        },
        rules: {
          "@typescript-eslint/no-confusing-void-expression": [
            "error",
            { ignoreArrowShorthand: true },
          ],
          "@typescript-eslint/no-floating-promises": [
            "error",
            { ignoreVoid: false, ignoreIIFE: true },
          ],
          "@typescript-eslint/no-misused-promises": [
            "error",
            { checksVoidReturn: { arguments: false, attributes: false } },
          ],
          "@typescript-eslint/consistent-type-exports": "error",
          "@typescript-eslint/no-unnecessary-condition": [
            "error",
            { allowConstantLoopConditions: true },
          ],
          "@typescript-eslint/no-unnecessary-type-assertion": "error",
          "@typescript-eslint/prefer-nullish-coalescing": [
            "error",
            { ignoreConditionalTests: true, ignoreMixedLogicalExpressions: true },
          ],
          "@typescript-eslint/prefer-optional-chain": "error",
          "@typescript-eslint/require-await": "error",
          "@typescript-eslint/switch-exhaustiveness-check": "error",
          "@typescript-eslint/unbound-method": ["error", { ignoreStatic: true }],
          "@typescript-eslint/promise-function-async": "error",
          "@typescript-eslint/prefer-readonly": ["error", { onlyInlineLambdas: false }],
        },
      }
    : null;

  return tseslint.config(
    {
      name: "easymo/ignores",
      ignores: [...DEFAULT_IGNORES, ...additionalIgnores],
    },
    baseConfig,
    ...(typedConfig ? [typedConfig] : []),
    ...overrides,
  );
}

const strictConfig = createStrictConfig();
export default strictConfig;
