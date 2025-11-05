# Phase 5 – Wallet, Ranking, Commission Engine

This phase introduces financial infrastructure (double-entry ledger), marketplace services (buyer, vendor, ranking), and hooks into existing EasyMO data to enable intents → quotes → purchases.

## Components

| Component | Description |
|-----------|-------------|
| `@easymo/wallet-service` | Double-entry ledger, commission handling, feature gated APIs. |
| `@easymo/ranking-service` | Scores vendors by blending internal metrics with live trip data from `admin-trips`. |
| `@easymo/vendor-service` | Vendor catalog management + quote generation. |
| `@easymo/buyer-service` | Buyer onboarding, intent capture, purchase recording with wallet integration stubs. |
| `packages/messaging` | Shared Kafka/Redis utilities (Phase 4) reused for resilient processing. |

## Data Model updates

The Prisma schema adds:
- Wallet tables (`WalletAccount`, `WalletTransaction`, `WalletEntry`, `CommissionSchedule`).
- Marketplace tables (`VendorProfile`, `BuyerProfile`, `Intent`, `Quote`, `Purchase`).

See migration `202502190100_phase5_wallet_marketplace` and the seed data in `packages/db/src/seed.ts` for deterministic fixtures.

## Feature Flags

- `FEATURE_WALLET_SERVICE`
- `FEATURE_MARKETPLACE_RANKING`
- `FEATURE_MARKETPLACE_VENDOR`
- `FEATURE_MARKETPLACE_BUYER`

## Payment Helpers

- **MoMo USSD**: helper flows verify MoMo deposit and payout hooks. Acceptance tests live in `services/wallet-service/test`.
- **Revolut**: mock integrations confirm settlement webhooks and ledger reconciliation. Covered by `services/wallet-service/test/revolut.spec.ts`.
- Ledger tests assert double-entry invariants and commission sweeps (`CommissionSchedule`) across wallet services.

## Local Stack

```bash
pnpm install
pnpm --filter @easymo/db prisma:migrate:dev
pnpm --filter @easymo/db seed
pnpm --filter @easymo/wallet-service start:dev
pnpm --filter @easymo/ranking-service start:dev
pnpm --filter @easymo/vendor-service start:dev
pnpm --filter @easymo/buyer-service start:dev
```

Remember to run Kafka/Redis if you plan to exercise Phase 4 messaging flows alongside these services.

## Testing & Verification

- `pnpm --filter @easymo/wallet-service test` covers ledger invariants, payment helpers, and commission accounting.
- `pnpm --filter @easymo/ranking-service test` validates scoring matrices, opt-out weighting, and tie-break logic.
- `pnpm --filter @easymo/vendor-service test` ensures inventory, quote generation, and MoMo payout hooks remain additive.
- `pnpm --filter @easymo/buyer-service test` verifies opt-in, intent lifecycle, Revolut settlement, and purchase persistence.
- Import `dashboards/phase4/*.json` into Grafana and monitor Kafka topics defined in `infrastructure/kafka/topics.yaml` while running end-to-end flows.

## Transition Resources

- See [`phase0-5-transition-plan.md`](./phase0-5-transition-plan.md) for the cross-phase inventory, staged enablement runbook, rollback toggles, and go-live checklist tying together Phases 0–5.
