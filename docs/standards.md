# Engineering Standards

Our JavaScript/TypeScript projects share a single lint, formatting, and type-checking toolchain. The presets live in [`packages/config/eslint`](../packages/config/eslint) and are consumed from the repository root.

## Linting

- Run `pnpm lint` before sending a pull request. This uses the shared strict flat-config from `@easymo/eslint-config` and also lints the admin app workspace.
- Use `pnpm lint:fix` to automatically apply safe fixes when possible.
- The configuration enforces strict TypeScript rules, React Hooks best practices, and prefers JSON-friendly logging patterns.

## Formatting

- Run `pnpm format` to apply the shared Prettier preset (`packages/config/eslint/prettier.config.cjs`).
- Use `pnpm format:check` to verify formatting in CI or pre-commit hooks.
- The Prettier preset standardizes 2-space indentation, 100-character line width, trailing commas, and LF line endings.

## Type Checking

- Run `pnpm type-check` (or the alias `pnpm typecheck`) to execute the full suite of strict type checks.
- The script validates the workspace root TypeScript project, the API service, the new environment schema package, and the shared logger utilities using the strict options defined in `packages/config/tsconfig.strict.json`.

## Continuous Integration

GitHub Actions run `pnpm format:check`, `pnpm lint`, and `pnpm type-check` on every push and pull request (see the updated [`ci.yml`](../.github/workflows/ci.yml) and [`node.yml`](../.github/workflows/node.yml)). Keep the local commands green to avoid CI failures.
