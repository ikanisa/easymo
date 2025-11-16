# Additive-Only Change Policy

This repository enforces a strict additive-only workflow so that platform-critical logic remains
stable while the new Admin Panel and Station PWA mature.

## Definition

- **Additive-only** means you may introduce new files, exports, components, route handlers,
  migrations, and configuration entries.
- You **must not** delete, rename, or substantially rewrite existing files, tables, functions, or
  behaviors.
- When extending code, prefer new modules or clearly delimited sections guarded by feature flags or
  env checks.

## Forbidden Paths

The following paths are completely off-limits unless a specific job explicitly marks them as
"ALLOWED":

- `supabase/functions/wa-webhook/**`
- `supabase/functions/**` (all existing Edge Functions)
- `supabase/migrations/**` (existing migrations only; new migrations must use fresh timestamped
  files)

Any PR touching these paths will be blocked by automation and review.

## Examples

- ✅ Adding `admin-app/app/dashboard/page.tsx`.
- ✅ Creating a new migration `supabase/migrations/20240925000000_add_mobility_tables.sql`. instead.
- ⛔ Editing an existing migration to "fix" data — write a follow-up migration.
- ⛔ Removing an obsolete util file — deprecate in place or add a wrapper.

## Emergency Override Process

1. Document the incident and remediation requirement in `INCIDENT_RUNBOOKS.md`.
2. Open a PR that:
   - Clearly labels the override (`chore: emergency override – additive-only guard`).
   - Includes sign-off from project lead and on-call engineer.
   - Contains mitigation and rollback steps.
3. After merge, schedule follow-up work to re-establish additive boundaries.

## Local Guard Expectations

- Install the repository pre-commit hook (documented in `docs/DEV_SETUP.md`).
- The hook must refuse to stage or commit changes under forbidden paths and highlight additive-only
  rules.
- Run `git diff --stat` before pushing; if deletions/renames show up, restate work as additive
  additions.

## Reporting Violations

- If automation flags a violation, stop work immediately.
- Add a note in `LOGS.md` (or the active PR description) describing what triggered the violation and
  how it was resolved.
- Repeat violations trigger review from the project lead before any further work continues.

## References

- Admin Panel README (`admin-app/README.md`)
- Station PWA README (`station-app/README.md`)
- Guardrail CI workflow (`.github/workflows/additive-guard.yml`)
- CODEOWNERS policy (`.github/CODEOWNERS`)
