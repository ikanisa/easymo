# Engineering Standards

This document captures the default linting, formatting, and type-check workflows that every
EasyMO project should follow. The shared tooling lives in the `@easymo/config` workspace package
and can be reused from any service or application inside the monorepo.

## Linting

- **Command:** `pnpm lint`
- **What it does:** Runs the root ESLint configuration which delegates to the shared presets in
  `packages/config/eslint`. The presets enable strict TypeScript analysis via
  `typescript-eslint`'s `strictTypeChecked` and `stylisticTypeChecked` bundles.
- **How to extend:**
  - Create an `eslint.config.js` file in your package and spread the relevant preset:

    ```js
    import reactConfig from "@easymo/config/eslint/react";

    export default [...reactConfig];
    ```

  - Use `@easymo/config/eslint/node` for backend and script packages.

- **Guiding rules:**
  - `console.log` is disallowed in favor of the structured logger under
    `packages/utils/log`.
  - `@typescript-eslint/no-unused-vars` ignores `_*` variables so placeholder arguments can be
    documented without lint noise.
  - Async APIs must either be awaited or intentionally voided; unhandled promises are treated as
    build failures.

## Formatting

- **Command:**
  - Fix files with `pnpm format`
  - Verify formatting in CI with `pnpm format:check`
- **What it does:** Uses the shared Prettier preset exported from
  `@easymo/config/eslint/prettier`. The preset enforces `printWidth: 100`, trailing commas, and LF
  line endings across the workspace.
- **Usage tips:**
  - The Prettier CLI operates on the same file set in both commands. Any formatting drift caught by
    `format:check` should be resolved by re-running `pnpm format`.
  - Add editor integration by pointing to `prettier.config.js` in the repository root.

## Type Checking

- **Command:** `pnpm type-check`
- **What it does:** Runs `tsc --noEmit` for the root application as well as the API service. New
  packages should extend `tsconfig.strict.json` to inherit the stricter compiler defaults (exact
  optional property types, `noUncheckedIndexedAccess`, etc.).
- **Extending strict mode:**
  - In package-specific `tsconfig.json` files use:
    ```json
    {
      "extends": "../../tsconfig.strict.json"
    }
    ```
  - Additional compiler options can be layered on top, but avoid downgrading the strict defaults
    unless there is a documented exception.

## Continuous Integration expectations

The main CI workflow enforces the standards above by running, in order:

1. `pnpm format:check`
2. `pnpm lint`
3. `pnpm type-check`

Packages should provide `lint`, `type-check`, and `test` scripts so they can be targeted via
`pnpm --filter`. New workstreams should call the shared presets rather than duplicating
configuration, ensuring changes to lint rules propagate through the monorepo automatically.
