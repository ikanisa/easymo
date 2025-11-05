# Phase 0–5 Transition Plan

This plan captures the cross-phase readiness work for moving EasyMO from the legacy admin + messaging stack to the new Supabase-backed platform. It consolidates inventory maps, enablement sequencing, rollback instructions, and the final go-live checklist so engineering, operations, and product teams have a single source of truth.

## 1. Inventory Maps & Feature Flags

### 1.1 Cross-Phase Surface Comparison

| Phase | Legacy Surface / Capability | New Surface / Capability | Notes |
|-------|-----------------------------|--------------------------|-------|
| Phase 0 (Baseline) | Legacy Admin spreadsheets, manual Supabase dashboard edits | Admin PWA (Vercel) + Supabase Edge Functions | Foundation – data migrations, identity alignment, monitoring hooks. |
| Phase 1 (Foundations) | Manual `.env` patching, ad-hoc SQL scripts | Managed environment templates (`docs/env/env.sample`), automated seeds (`supabase/seed/fixtures/*.sql`) | Establishes deterministic data + secrets baseline. |
| Phase 2 (Read-only APIs) | CSV exports from Postgres | `/admin/*` REST + Supabase functions with RLS | Mirrors existing dashboards with audited API layer. |
| Phase 3 (Admin PWA Read-only) | Legacy dashboards (Looker, Notion) | Admin PWA read-only views (`/leads`, `/campaigns`, `/marketplace`) | Feature flags gate new views so cohorts can be rolled back. |
| Phase 4 (Mutations / Messaging) | WhatsApp bot via legacy Twilio worker | `@easymo/whatsapp-bot`, `@easymo/voice-bridge`, `agent-core` flows | Messaging orchestrated through Kafka/Redis with structured logging. |
| Phase 5 (Router Switch) | Legacy routing scripts, manual voucher flows | Router backed by `services/*` microservices (wallet, ranking, vendor, buyer) | Final cut-over – router delegations respect feature toggles & migrations. |

### 1.2 Domain Feature Flags

| Domain | Flag(s) | Scope | Default | Rollback Behaviour |
|--------|---------|-------|---------|--------------------|
| Admin UI Foundations | `FEATURE_FLAG_DUALCONSTRAINTMATCHING_ENABLED`, `FEATURE_FLAG_BASKET_CONFIRMATION_ENABLED` | Admin PWA server features | `0` (disabled) in prod until cohort ready | Flip to `0` to reinstate legacy review workflow. |
| Messaging Agents | `FEATURE_AGENT_CHAT`, `FEATURE_AGENT_VOICE`, `FEATURE_AGENT_VOUCHERS`, `FEATURE_AGENT_CUSTOMER_LOOKUP` | Supabase functions + agent-core | `0` in prod | Toggle to `0` to fall back to legacy WhatsApp/Twilio flows. |
| Wallet & Marketplace | `FEATURE_WALLET_SERVICE`, `FEATURE_MARKETPLACE_VENDOR`, `FEATURE_MARKETPLACE_BUYER`, `FEATURE_MARKETPLACE_RANKING` | Services + router | `0` in prod | Toggle to `0` to redirect router calls to legacy purchasing scripts. |
| Admin Mutations | `FEATURE_AGENT_COLLECTPAYMENT`, `FEATURE_AGENT_WARMTRANSFER` | Agent-core | `0` | Disable to force manual payment + support transfers. |
| Experimental Surfaces | `ENABLE_AGENT_CHAT`, `ENABLE_AGENT_VOICE`, `ENABLE_AGENT_VOUCHERS`, `ENABLE_AGENT_CUSTOMER_LOOKUP` | Next.js config / Supabase functions | `false` | Keep false to avoid enabling hidden navigation. |

### 1.3 Diagram – Router vs. Legacy

```
          Legacy Stack                              Phase 5 Stack
┌──────────────────────────┐                 ┌──────────────────────────┐
│ Admin CSV Exports        │                 │ Admin PWA + Edge Functions│
│ Manual Voucher Scripts   │                 │ Feature-flagged REST APIs │
│ Twilio Worker            │    Switches     │ agent-core Orchestrator   │
│ Google Sheets            │ ─────────────▶  │ Kafka + Redis Pipelines   │
│ Email Playbooks          │                 │ Wallet/Ranking Services   │
└──────────────────────────┘                 └──────────────────────────┘
            ▲                                          │
            │ Rollback toggles route back              │ Supabase migrations + CI guard rails
            └──────────────────────────────────────────┘
```

## 2. Staged Enablement (Non-Prod)

Run this in staging/UAT before production. Capture metrics in the linked dashboard snapshots.

1. **Foundations**  
   - Actions: apply latest Supabase migrations, seed fixtures, sync environment variables.  
   - Metrics: migration success (CI `pnpm supabase:test` job), db migration timestamps, seed idempotency counts.
2. **Read-only APIs**  
   - Actions: deploy Supabase Edge Functions + read-only Admin APIs.  
   - Metrics: HTTP 2xx rate from synthetic checks, Prometheus `admin_api_latency_seconds`.  
   - Gates: error budget `<1%` for 24h, smoke tests (`scripts/test-functions.sh`) green.
3. **Admin PWA Read-only**  
   - Actions: enable navigation flags for read-only pages in staging.  
   - Metrics: Lighthouse performance score ≥ 90, Vercel preview analytics (<1% error).  
   - Gates: QA smoke checklist (read-only) signed off.
4. **Mutations**  
   - Actions: enable write operations behind feature flags (`FEATURE_AGENT_CHAT`, wallet flags).  
   - Metrics: mutation success rate, Supabase row audit logs, contract tests (`pnpm --filter @easymo/wallet-service test`).  
   - Gates: zero failed ledger invariants, Ops tabletop run.
5. **Router Switch**  
   - Actions: flip router env `FEATURE_MARKETPLACE_*` to `1`, update Supabase secrets.  
   - Metrics: router latency (`router_switch_seconds`), Kafka consumer lag, vouchers redemption success.  
   - Gates: 24h burn-in with ≤2% error, dashboards stable.

Record metrics after each gate in `dashboards/phase4/*.json` and attach exports to the runbook.

## 3. Rollback Playbooks & Rehearsal Log

### 3.1 Rapid Toggle Matrix

| Capability | Disable Command | Expected Result |
|------------|-----------------|-----------------|
| Admin mutations | `supabase secrets set FEATURE_AGENT_CHAT=false`<br>`supabase secrets set FEATURE_AGENT_VOICE=false` | Revert WhatsApp + voice flows to legacy worker. |
| Wallet services | `supabase secrets set FEATURE_WALLET_SERVICE=false` | Router falls back to legacy payment processor scripts. |
| Marketplace ranking/vendor/buyer | `supabase secrets set FEATURE_MARKETPLACE_RANKING=false`<br>`...VENDOR=false`<br>`...BUYER=false` | Router returns cached legacy recommendations. |
| Admin UI risky toggles | `vercel env pull` + set `FEATURE_FLAG_*` to `0` | Admin PWA hides mutation buttons; operators continue in legacy sheet. |
| Router cut-over | Set `ROUTER_PHASE=legacy` in config map | Hard switch back to legacy router handlers. |

Reference the core playbook (`ROLLBACK_PLAYBOOK.md`) for stabilization steps; this matrix focuses on flag toggles for Phase 5 scopes.

### 3.2 Rehearsal & Sign-off

| Date | Scenario | Participants | Outcome | Follow-ups |
|------|----------|--------------|---------|------------|
| 2025-02-01 | Wallet service rollback | On-call (Alex), DB (Priya), Product (Maya) | ✅ Success – no data loss | Automate `wallet_snapshot.sql` export. |
| 2025-02-03 | Router cut-over revert | On-call (Dev), Infra (Lina) | ✅ Success – 4 min total | Add Grafana alert for `router_switch_seconds`. |
| 2025-02-05 | Agent chat disable | On-call (Sam), Support (Eve) | ✅ Success – sessions drained | Document operator messaging macro. |

Update this table after each rehearsal. Store exports in `docs/runbooks/rollback-drills/`.

## 4. Go-Live Checklist

1. **Supabase Migrations**  
   - `pnpm --filter @easymo/db prisma:migrate deploy` executed in staging + production.  
   - `supabase db diff --linked` clean; all Phase 5 migrations applied.  
   - Storage buckets verified (`insurance-docs`, `kyc-documents`, `vouchers`, `menu-source-files`, `ocr-json-cache`).
2. **CI Status**  
   - `main` branch CI green (GitHub Actions `node.yml`, `synthetic-checks.yml`).  
   - Contract tests for wallet/vendor/buyer/ranking services pass.  
   - Supabase function integration tests (`scripts/test-functions.sh`) succeed.
3. **Lighthouse & Frontend**  
   - Latest Vercel preview Lighthouse ≥ 90 (Performance, Accessibility, Best Practices).  
   - No blocking Core Web Vitals regressions.  
   - Admin PWA preview signed off by Design/Support.
4. **Operational Alerting**  
   - Grafana dashboards imported: `dashboards/phase4/messaging_overview.json`, `dashboards/phase4/voice_bridge.json`, router/marketplace panels.  
   - Alerts configured for: migration failures, router switch latency, wallet ledger anomalies, voucher redemption drop.  
   - PagerDuty schedule confirmed; on-call acknowledges go-live window.
5. **Data Protection & Backups**  
   - Snapshot `wallet` and `marketplace` schemas pre-cut-over.  
   - Verify automated backups + retention via Supabase dashboard.  
   - Export audit logs to secure storage.
6. **Communication & Approvals**  
   - Final Go/No-Go sign-off recorded (Engineering, Product, Operations).  
   - Support playbooks distributed; macros updated.  
   - Incident bridge + communication plan rehearsed.

Once all boxes are checked and sign-offs captured, schedule the production enablement following the staged runbook above.
