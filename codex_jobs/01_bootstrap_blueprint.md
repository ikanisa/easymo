# Job: Bootstrap Repo Blueprint & Sanity

## Goal
Ensure the repo follows the standard blueprint so agent workflows (planning, PRs, CI) run smoothly.

## Constraints
- Additive-only; do not delete or rewrite existing working code.
- Allowed paths only (see agent/policies/ALLOWLIST.json).

## Steps (Agent)
1) Verify required folders exist:
   - app/, packages/, supabase/{migrations,seed}/, agent/{tools,policies}/, .github/workflows/, docs/, .changeset/
2) Ensure policy files exist:
   - agent/policies/ALLOWLIST.json
   - agent/policies/GUARDRAILS.md
3) Ensure CI & housekeeping exist:
   - .github/workflows/ci.yml
   - .github/dependabot.yml
   - .gitignore
4) Supabase local:
   - Check supabase/config.toml exists
   - If ports conflict, propose alternate db port in PR body (do not change without approval)
5) Documentation:
   - If missing, create docs/README.md & docs/ADR_TEMPLATE.md, and update docs/DECISIONS.md with entry:
     “Initialized repo blueprint and agent guardrails.”
6) PR:
   - Title: "chore: ensure repo blueprint + agent guardrails"
   - Include checklist and “What changed / Why”.
   - Add rollback suggestion (revert commit).

## Acceptance
- CI green.
- Reviewer verifies files present and no destructive edits.

