# Refactor Progress Tracker

| Phase | Description                  | Owner | Status   | Notes                                                                                                                                                                                     |
| ----- | ---------------------------- | ----- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Baseline & Inventory         | codex | Complete | Schema snapshot + ERD in `supabase/snapshots/phase0/`, docs in `docs/refactor/phase0/`.                                                                                                   |
| 1     | Data Model Consolidation     | codex | Complete | Contacts auto-link to profiles (`20251012140000`), basket joins archived, naming guide + docs updated.                                                                                    |
| 2     | Function & Trigger Hygiene   | codex | Complete | Migrations `20251011113000/121000/124000` deployed; matching RPCs invoker, privileged functions isolated (`security`, `menu_admin`). SQL regression scripts committed under `tests/sql/`. |
| 3     | Edge Function Modularization | codex | Complete | Router smoke tests added (`tests/edge/`), SQL regressions in place; deployment playbook captured in `docs/refactor/edge_functions.md`.                                                    |
| 4     | Observability & Automation   | codex | Complete | Pre-commit lint (`tools/hooks/`), CI dry-run via `.github/workflows/ci.yml`, dashboards & data-quality queries documented in `docs/observability.md`.                                     |
| 5     | Decommission & Archive       | codex | Complete | Archive exports captured, legacy references guarded (`tools/lint/check_archive_refs.ts`), final runbook in `docs/refactor/phase5/runbook.md`.                                             |

> Update this table as phases advance; link artifacts (ERD, docs, migration
> PRs).

## Phase 3 Summary

- Dine-in, marketplace, mobility, and wallet flows now reside under `domains/`.
- Deprecated insurance flow archived; admin menu entry removed.
- SQL test scaffolds in `tests/sql/` await pgTAP integration.
