# Inventory App Gap & Decision Record

## Summary
- The monorepo currently ships the admin console, Waiter PWA, and real-estate PWA; there is no `inventory-app` workspace package or deployable target checked into source control.【62a530†L1-L41】【456644†L1-L9】
- Supabase only contains functions for the existing mobility, marketplace, and agent workloads—none are dedicated to an inventory-facing experience.【9740f9†L1-L13】
- Because the historical codebase is gone, a greenfield rebuild would span authentication, stock management flows, fulfillment integrations, and observability layers comparable in scope to the existing admin console surface area.【3807fe†L1-L15】
- Rebuild effort is estimated at **4–5 engineering sprints (8–10 weeks)**, assuming two full-stack engineers with Supabase expertise plus design/product support.
- Decision: **Defer the rebuild** and codify a deployment guard so production pipelines ignore any accidental `inventory-app` directories until a funded project is scheduled.

## Missing Surface Inventory
| Layer | Findings |
| --- | --- |
| Frontend | No `inventory-app` directory or package manifest. Workspace globbing only covers `admin-app`, `waiter-pwa`, `real-estate-pwa`, and package/service workspaces.【62a530†L1-L41】【456644†L1-L9】 |
| Backend APIs | Supabase functions list lacks inventory-specific endpoints (e.g., catalog CRUD, stock alerts). Only mobility/agent functions are present.【9740f9†L1-L13】 |
| Shared Services | Service catalog excludes an inventory service; existing services focus on wallet, vendor, buyer, ranking, etc.【7396ad†L1-L2】 |
| UI Reference | Admin console already manages 25+ feature areas; recreating similar UX for inventory would require navigation shells, data grids, mutations, and telemetry from scratch.【3807fe†L1-L15】 |

## Effort Estimate
| Track | Scope Highlights | Estimate |
| --- | --- | --- |
| Core scaffold | Next.js 14 app setup, Supabase client wiring, auth/session management, RBAC shell | 2 sprints |
| Inventory features | Catalog CRUD, stock adjustments, supplier intake, notifications, analytics dashboards | 1.5 sprints |
| Integrations | Supabase Edge Functions for inventory mutations, scheduled jobs, webhook ingestion | 1 sprint |
| QA & hardening | Vitest/E2E coverage, observability hooks, accessibility polishing, launch readiness | 0.5 sprint |

_Total: 4–5 sprints (8–10 weeks) assuming two engineers; add +1 sprint if dedicated mobile surfaces are required._

## Decision & Guardrails
- **Rebuild deferred** until roadmap capacity opens.
- Added a prebuild guard (`scripts/assert-inventory-app-deferred.mjs`) wired into the root `prebuild` so CI/CD fails fast if an `inventory-app` directory reappears without an explicit override (`ALLOW_INVENTORY_APP=true`).【F:package.json†L8-L24】【F:scripts/assert-inventory-app-deferred.mjs†L1-L24】
- Any experimental spikes must run with the override flag to avoid breaking the shared pipelines.

## Stakeholder Communication & Roadmap Updates
1. Product & Ops
   - Confirm deferral in the weekly ops sync; position rebuild as a Q3 candidate pending staffing.
   - Share this record so downstream teams know inventory tooling remains manual.
2. Engineering
   - Document guardrails in `README.md` and add to release planning checklist.
   - Capture backlog epic: "Inventory Console Rebuild" with the sprint estimates above.
3. Delivery Roadmap
   - Update roadmap to show "Inventory Console" in Deferred column with gating dependencies (hiring, schema stabilization).
   - Revisit decision during quarterly planning or if customer escalation occurs.
