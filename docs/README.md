# Docs

- `DECISIONS.md` – list of ADRs
- `ADR_TEMPLATE.md` – copy this when adding a new decision
- `file_search.md` – Responses API reference for enabling the managed file search tool

## Strangler Modernization Notes

- New modernization workspaces live in `apps/admin-pwa/`, `apps/router-fn/`, and `apps/app-apis/`.
- Shared packages start empty in `packages/config/`, `packages/ui/`, `packages/clients/`, and `packages/utils/`.
- Infrastructure placeholders sit in `infra/supabase/` and `infra/ci/`.
- See `docs/decisions/` for ADRs governing how these pieces coexist with the legacy directories during rollout.
