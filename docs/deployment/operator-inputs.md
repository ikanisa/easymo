# Operator inputs checklist

Collect the following information **before** attempting to link or provision any external services. Store
responses in a secure location (e.g., 1Password vault) and share only with the individuals that require
access.

## GitHub

| Field | Description | Example |
| --- | --- | --- |
| Organization/account | GitHub organization or user namespace that will host the repository | `easymo-inc` |
| Repository name | Name of the repo to create or reuse | `easymo-admin` |
| Visibility | `public` or `private` | `private` |
| Default branch | Usually `main` or `trunk` | `main` |
| Branch protection policy | Required approvals, status checks, force-push policy | Require 1 review, block force pushes |
| Required status checks | GitHub Action workflow names that must succeed before merge | `CI (build-test)` |
| Issues enabled? | Whether to enable the GitHub Issues tab | `yes` |
| Actions enabled? | Whether GitHub Actions should be on | `yes` |

## Supabase

| Field | Description | Example |
| --- | --- | --- |
| Project name | Display name in the Supabase dashboard | `easyMO Production` |
| Project ref | Existing ref if reusing a project | `abcd1234` |
| Region | Select the closest region to end-users | `us-east-1` |
| RLS policy posture | Strict/lenient + expected review cadence | "RLS enforced on all tables" |
| Edge Functions | Required? list names & triggers | `send-invite` (HTTP) |
| Migration strategy | Who reviews + how to apply (CLI vs UI) | Use Supabase CLI w/ PR review |
| Data restore policy | Point-in-time recovery expectation & contacts | PITR 7 days, contact DBA |

## Vercel

| Field | Description | Example |
| --- | --- | --- |
| Team/scope | Vercel team slug or personal account | `team_easymo` |
| Project name | Vercel project identifier | `easymo-admin` |
| Framework root | Directory containing Next.js app | `admin-app` |
| Production domain | Custom domain mapped to production | `admin.easymo.com` |
| Preview domains policy | Default Vercel previews or custom restrictions | default |
| Analytics preference | Vercel Analytics enabled? | Enabled (Production only) |

## Framework / build metadata

| Field | Description | Example |
| --- | --- | --- |
| Framework | Next.js / Remix / etc. | Next.js (App Router) |
| Package manager | pnpm / npm / yarn | pnpm |
| Build command | Command executed by CI/Vercel | `pnpm build` |
| Dev command | Local development command | `pnpm dev` |
| Output directory | Build output location | `.next` |
| Node runtime | Minimum Node.js version | 20.x |
| Monorepo layout | Document workspace roots if applicable | `admin-app` workspace |

## Environment variables (names only)

List any additional variables beyond those in `.env.example`. Document the scope (Preview/Production/Both)
and the consumer (Next.js client, server components, Edge Functions, Supabase config, etc.).

## Compliance & escalation

| Field | Description | Example |
| --- | --- | --- |
| License | Approved open-source license for the repo | MIT |
| Security policy contact | Email/group for vulnerability disclosure | security@easymo.com |
| Incident commander | Primary on-call contact | oncall@easymo.com |
| Rollback approver | Person who can authorize production rollback | CTO |

Keep this document updated when policies or contacts change.
