import nodeConfig from "@easymo/config/eslint/node";

export default [
  ...nodeConfig,
  {
    files: ["tests/**/*.{ts,js}", "vitest.config.ts"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["tests/*.test.ts", "vitest.config.ts"],
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
