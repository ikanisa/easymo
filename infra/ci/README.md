# Continuous Integration Playbooks

This directory contains reusable GitHub Actions workflows and configuration
artifacts that keep the EasyMO platform healthy.

| File | Purpose |
| --- | --- |
| `monorepo-quality.yml` | Linting, type-checking, tests, and build verification for the monorepo. |
| `supabase-drift.yml` | Detects drift between committed Supabase migrations and the managed database instance. |
| `lighthouse-audit.yml` | Runs Lighthouse audits against the production bundle to enforce UX and performance SLOs. |
| `preview-deploy.yml` | Publishes preview deployments to Vercel and Supabase Functions when secrets are available. |
| `lighthouserc.json` | Shared Lighthouse CI configuration consumed by the audit workflow. |

Workflows are symlinked into `.github/workflows` so that GitHub can execute them
while keeping the canonical definitions in this folder.
