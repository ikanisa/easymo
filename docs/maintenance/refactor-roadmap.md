# Full-Stack Refactor Roadmap

This roadmap captures staged cleanup work so we can improve maintainability and
ship the Admin stack with confidence. Each wave keeps to the repo’s
additive-only guardrails and can be delivered as focused PRs.

## 1. Baseline & Metrics

- **Hotspot inventory:** Largest TS/TSX files (`admin-app/lib/mock-data.ts`,
  `admin-app/lib/queries/baskets.ts`,
  `admin-app/components/baskets/IbiminaRegistryTable.tsx`,
  `admin-app/components/baskets/LoanReviewDrawer.tsx`,
  `admin-app/components/assistant/AssistantPanel.tsx`) should be split into
  domain modules or backed by factories.
  | Lines | Path                                                    |
  | ----: | ------------------------------------------------------- |
  |   832 | `admin-app/lib/mock-data.ts`                            |
  |   607 | `admin-app/lib/queries/baskets.ts`                      |
  |   498 | `admin-app/components/baskets/IbiminaRegistryTable.tsx` |
  |   440 | `admin-app/components/baskets/LoanReviewDrawer.tsx`     |
  |   376 | `admin-app/components/assistant/AssistantPanel.tsx`     |
- **Debt tracking:** Wire `tools/monitoring/admin-synthetic-checks.ts` into CI
  (nightly GitHub Action) so regressions are caught early.
- **Instrumentation:** Promote `insurance-ocr` metrics webhook and extend
  logging helpers to other queues (`order-pending-reminder`, `cart-reminder`).

## 2. Domain Extraction

- **Data provider:** Retired in favour of scoped services under
  `admin-app/lib/**/…-service.ts`. _(Alerts, diagnostics, hub, vouchers, orders,
  bars, stations, campaigns, insurance, menus/OCR, staff, QR, templates, flows,
  storage, settings preview now covered by dedicated modules.)_
- **Mock data:** Generate fixtures with `tests/deps/factories/*` helpers instead
  of monolithic literals; add factory functions per schema to ease unit testing.
  _(Factories now cover users, bars/stations, vouchers, campaigns, dashboard,
  menu/OCR, insurance, orders, notifications, staff, QR, templates, audit,
  storage, settings.)_
- **Notifications:** Route outbox APIs through `admin-app/lib/notifications/`
  services to remove duplicate fetch logic. _(Service + React Query wiring now
  live.)_
- **Basket UI:** Create subcomponents in `admin-app/components/baskets/` for the
  registry table/drawer; aim for ≤250 lines each with clear prop typing.
- **Users/Admin Hub/Vouchers/Orders/Bars/Stations/Campaigns/Insurance/Flows:**
  Migrate admin hub stats, voucher summaries, order feeds, bar/station
  directories, campaign listings, insurance quotes, flow/menu assets, and user
  management APIs to dedicated services. _(Completed: hub, vouchers, orders,
  bars, stations, campaigns, insurance, flows, users.)_

## 3. API & Edge Hardening

- **Next.js APIs:** Adopt shared validation/response helpers under
  `admin-app/lib/api/http.ts`; ensure every route returns structured problem
  detail on errors.
- **Supabase Functions:** Replicate the telemetry helper for reminder workers
  and wallet queues; add Deno unit tests mirroring
  `insurance-ocr/index.test.ts`.
- **Policies:** Confirm new migrations include RLS + lintable SQL (extend
  `tests/sql/` coverage).

## 4. Go-Live Gate

- Run Phase 6 smoke checklist (migrations, edge deploys, synthetic checks).
- Deliver final runbook updates + rollback procedures with screenshots and links
  to monitoring dashboards.
- Host pairing review to verify new modules meet readability/ownership
  standards; capture sign-off in `docs/maintenance/retro.md`.

> Track progress by mirroring these sections in the project board. Each bullet
> should become a discrete ticket to keep reviews tight and unblock parallel
> workstreams.
