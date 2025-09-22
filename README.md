# easyMO Deployment Toolkit

This repository contains the source for the easyMO administrative web app and supporting infrastructure
artifacts used to deploy it. The goals of this project are:

- keep the application codebase ready for production-grade deployment,
- provide idempotent infrastructure automation that can be re-run safely, and
- document the GitHub ⇄ Vercel ⇄ Supabase integration so new contributors can operate confidently.

> **Note**
> The automation described here deliberately never stores or prints secret values. All variables are
> referenced by name only. Populate secrets in the target platforms (GitHub, Supabase, Vercel) directly.

## Repository layout

```
admin-app/          # Next.js app-router client (Next 14+ compatible layout)
docs/deployment/    # Deployment and operations runbooks
supabase/           # Placeholder for migrations & edge functions managed by Supabase CLI
```

## Quick start

1. Review `docs/deployment/operator-inputs.md` and gather the credentials, organization settings, and
   compliance contacts required to link GitHub, Supabase, and Vercel.
2. Follow `docs/deployment/bootstrap.md` to provision or link the external services and to connect the
   repository to Vercel and Supabase locally.
3. Keep `.env` files **out of Git**. Use `.env.example` as the canonical list of environment variable names
   needed by the app and infrastructure automation.
4. All pull requests must use the PR template in `.github/pull_request_template.md` and should follow the
   conventional commits spec for titles (e.g., `feat: add audit log stream`).

## Continuous integration

GitHub Actions is configured in `.github/workflows/ci.yml`. The workflow is intentionally idempotent:

- It short-circuits when no `package.json` is present (allowing infrastructure-only branches to pass).
- When the app is present, it installs dependencies using `pnpm` and runs format, lint, and test commands.
- It is designed to be required by the default branch protection before merges.

## Deployment environments

Deployment policies, environment matrices, runbooks, and rollback guidance live under
`docs/deployment`. The primary hand-off artifact is `docs/deployment/final-report.md`, which is the single
source-of-truth for:

- Repository, Supabase, and Vercel linkage metadata
- Environment variable mappings and scoping
- Post-deploy verification checklists
- Rollback procedures for Git, Vercel, and Supabase

Always update the report after performing provisioning or incident response operations so the documentation
stays accurate and auditable.
