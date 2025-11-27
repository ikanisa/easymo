import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

const reactBoundaryPlugin = {
  rules: {
    "enforce-directives": {
      meta: {
        type: "problem",
        docs: {
          description:
            "Ensure React entry files declare clear client/server boundaries and avoid server imports in client components.",
        },
        messages: {
          mixedDirectives:
            "Do not combine 'use client' and 'use server' directives in the same module.",
          serverImportInClient:
            "Avoid importing server-only module '{{source}}' in a client component. Move the logic to a server file or remove the client directive.",
        },
      },
      create(context) {
        const serverOnlyImports = new Set(["next/server", "next/headers", "server-only"]);
        let hasUseClient = false;
        let hasUseServer = false;

        return {
          Program(node) {
            for (const statement of node.body) {
              if (statement.type !== "ExpressionStatement" || !statement.directive) break;

              if (statement.directive === "use client") {
                hasUseClient = true;
              }

              if (statement.directive === "use server") {
                hasUseServer = true;
              }
            }

            if (hasUseClient && hasUseServer) {
              context.report({ node, messageId: "mixedDirectives" });
            }
          },
          ImportDeclaration(node) {
            if (!hasUseClient) return;

            const source = node.source.value;

            if (typeof source === "string" && serverOnlyImports.has(source)) {
              context.report({ node, messageId: "serverImportInClient", data: { source } });
            }
          },
        };
      },
    },
  },
};

const nodeScriptGlobals = {
  require: "readonly",
  module: "readonly",
  __dirname: "readonly",
  process: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

const runtimeGlobals = {
  console: "readonly",
  Request: "readonly",
  Response: "readonly",
  Headers: "readonly",
  URL: "readonly",
  self: "readonly",
  location: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "@next/next": nextPlugin,
      "react-boundary": reactBoundaryPlugin,
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }],
      "@next/next/no-async-client-component": "error",
      "react-boundary/enforce-directives": "error",
      "no-case-declarations": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
    settings: {
      next: {
        rootDir: ["admin-app"],
      },
    },
  },
  {
    files: ["scripts/**/*.js", "waiter-pwa/scripts/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: nodeScriptGlobals,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: runtimeGlobals,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-require-imports": "error",
    },
  },
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "coverage/**",
      "**/*.config.js",
      "**/generated/**",
    ],
  },
];
