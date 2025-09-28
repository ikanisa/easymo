# WA Module Inventory Map

| Area | Module | Notes |
| --- | --- | --- |
| Routing | `router/index.ts`, `router/interactive_button.ts`, `router/interactive_list.ts`, `router/text.ts`, `router/location.ts`, `router/media.ts` | Entry points dispatch to feature modules with idempotency + guards. |
| Mobility | `flows/mobility/nearby.ts`, `flows/mobility/schedule.ts`, `rpc/mobility.ts` | Nearby drivers/passengers + schedule flow using Supabase RPCs. |
| Marketplace | `flows/marketplace.ts`, `rpc/marketplace.ts` | Business directory create/browse, persists to `businesses` table. |
| Baskets | `flows/baskets.ts`, `rpc/baskets.ts` | Create/join/share baskets, QR generation, confirm prompts. |
| MoMo QR | `flows/momo/qr.ts`, `rpc/momo.ts`, `utils/momo.ts` | Generates QuickChart QR + logs to `momo_qr_requests`. |
| Insurance | `flows/insurance/ocr.ts`, `utils/media.ts`, `notify/sender.ts` | Media ingestion to storage + queue + admin alerts. |
| Wallet | `flows/wallet/*.ts`, `rpc/wallet.ts` | Balance summary, earn, transactions, redeem, promoter board. |
| Admin | `flows/admin/hub.ts`, `flows/admin/actions.ts`, `flows/admin/commands.ts`, `flows/admin/auth.ts` | Admin hub UI + `/sub` commands, auth + audit logging. |
| Shared | `utils/text.ts`, `utils/confirm.ts`, `utils/share.ts`, `observe/log.ts` | Formatting, confirm prompt helper, logging.
