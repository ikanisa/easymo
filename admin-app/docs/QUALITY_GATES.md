# Admin App Quality Gates

## Overview
TypeScript build failures now block both local builds and CI deployments. The `ignoreBuildErrors` flag has been disabled in
`next.config.mjs`, so every developer must resolve type errors before submitting a PR. The GitHub Actions workflow enforces the
same policy by running type-check, lint, and test steps with `continue-on-error` disabled.

## Required local checks
Run these commands from the repo root before pushing changes:

```bash
pnpm exec tsc -p admin-app/tsconfig.ci.json --noEmit
pnpm --filter @easymo/admin-app lint
pnpm --filter @easymo/admin-app test -- --run
```

- **Type check** uses the CI configuration so the compiler sees the same paths, module declarations, and strictness the pipeline
does.
- **Lint** fails if any warnings are emitted (`--max-warnings=0` in CI). Fix or suppress issues locally so the workflow remains
green.
- **Tests** should pass in non-watch mode. If you scope tests, document that in the PR body and re-run the full suite before merge.

## Troubleshooting tips
- If `@easymo/ui` imports cannot be resolved, ensure the module declarations under `admin-app/types/easymo-ui.d.ts` include the
widgets/components you added.
- For Supabase helpers, prefer the typed factories in `lib/server/supabase-admin.ts` and `lib/supabase/realtime.ts` so runtime
headers/cookies stay in sync.
- Regenerate mock data via the helpers in `lib/test-utils/factories` when the schema changes. Keeping mocks aligned prevents
unexpected TypeScript regressions late in the release cycle.

## CI enforcement
CI runs the same commands inside `.github/workflows/admin-app-ci.yml`. Any type error, lint violation, or failing test now marks
the workflow as failed. Keep branches rebased so you inherit the latest fixes, and highlight notable compiler or lint upgrades in
team release notes so everyone adjusts their local setup promptly.
