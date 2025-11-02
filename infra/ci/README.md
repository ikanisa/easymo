# CI/CD Infra (Strangler Workbench)

This directory will capture the next-generation pipelines that will gradually replace the scripts in `infrastructure/` and `.github/` (once migrated).

Strangler tactics:

- Start by codifying environment-agnostic workflows and delegate to the current jobs until confidence grows.
- Mirror deployment steps against staging using feature flags from `packages/config` to control rollout.
- Keep extensive runbooks in `docs/` so the team can trace which system is responsible for each deploy.

> **Status:** placeholder only – no active CI configuration lives here yet.
