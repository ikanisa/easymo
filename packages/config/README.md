# Config (Strangler Workbench)

This package fronts the environment configuration that will be shared across both the legacy runtime (`apps/api/`, `services/*`) and the new surfaces (`apps/admin-pwa/`, `apps/router-fn/`, `apps/app-apis/`).

Strangler goals:

- Provide typed accessors that first read the new feature-flag keys and fall back to the existing `.env` variables.
- Encapsulate runtime decisions (like routing between old/new stacks) to keep business logic clean.
- Offer a single place to document rollout levers during the coexistence period.

> **Status:** placeholder only – initial implementation proxies through to the legacy env names.
