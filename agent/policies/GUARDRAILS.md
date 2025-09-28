# Agent Guardrails (easymo)

## Core Principles

- Additive-only changes by default: do not delete or rewrite working code unless
  explicitly instructed.
- Respect the allow-list: only modify paths listed in
  agent/policies/ALLOWLIST.json.
- Never touch secrets or .env files. Never print secrets in logs.
- All DB changes must be via files under supabase/migrations/.
- Always open a PR; do not push directly to main.
- If a step fails, propose the next-best safe option and log what you tried.

## Safe Operating Rules

- Git: create feature branches as feat/<short-task-slug>.
- CI: ensure .github/workflows/ci.yml passes locally (if possible) before
  opening PR.
- Docs: for significant changes, add or update an ADR in docs/ (use
  ADR_TEMPLATE.md).
- Supabase: prefer `db diff` + migration files over ad-hoc SQL.

## Review Gates

- Do not request auto-merge if CI is failing.
- For schema changes, require one human reviewer.

## Communication

- Summarize plan steps at the top of the PR description.
- Include a checklist of files touched and why.
