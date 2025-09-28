# Job: <short title>

## Goal

<one-sentence desired outcome>

## Constraints

- Additive-only; do not break existing flows.
- Follow Guardrails (agent/policies/GUARDRAILS.md) and Allowlist.

## Steps (Agent)

1. Plan: List files to add/modify and why (short).
2. Apply: Implement changes within allowed paths.
3. Supabase: If DB changes are needed, create migration files and explain.
4. CI: Ensure baseline workflow passes.
5. PR: Open a PR with:
   - Summary
   - Files changed and rationale
   - Testing notes (what you ran and results)
   - Rollback suggestion

## Acceptance

- CI green.
- Reviewer checklist passed.
