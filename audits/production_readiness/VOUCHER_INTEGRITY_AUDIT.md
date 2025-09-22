# Voucher Integrity Audit

## QR / PNG Pipeline
- PNG preview generated via voucher preview Edge Function (bridge target `voucherPreview`). UI falls back to design mock when unavailable (`admin-app/app/api/vouchers/preview/route.ts:18-70`).
- QR tokens produced by `/api/qr/generate`; table includes `token`, `barName`, `tableLabel`, `printed` status (`admin-app/app/api/qr/generate/route.ts`).
- No evidence of re-encoding safeguards; recommend binary diff tests to ensure QR bitmaps remain unmodified.

## Unique Code Guarantees
- `vouchers` table enforces unique `code5` (see `DATA_MODEL_DELTA.md`).
- Voucher issuance uses random 5-digit generator; ensure collision handling (currently simple Math.random – risk of duplicates in large batches).

## State Integrity
- Issuance: `/api/vouchers/generate` writes vouchers, logs audit entry, returns integration badge.
- Sending: `/api/vouchers/send` updates status to `sent`, records audit.
- Redemption: Station PWA expected to transition to `redeemed`; ensure atomic update in Supabase (not visible in repo – confirm Edge Function or RPC ensures `status='issued'` precondition before update).
- Events: `voucher_events` should receive corresponding entries; confirm triggers or API writes exist.

## Scope Enforcement
- Station scope stored on voucher; redeem flow must verify `station_id == station_scope`. Ensure RPC checks this.
- Policy: Outbound messaging blocked for opt-outs/quiet hours, preventing unauthorized sends.

## Replay & Double Spend
- No offline queue; double redeem risk if network flaps (see risk R4). Need server-side idempotency via `voucher_events` or unique constraint on `redeemed_at` update.

## Expiry Handling
- Expiry stored as timestamp; no automated cron to void after expiry. Add scheduled job or policy engine check.

## Audit Trail
- `recordAudit` logs voucher actions; `voucher_events` provide chronological history. Ensure API ensures both entries created for send/redeem/void actions.

## Recommendations
1. Implement Supabase constraint or function ensuring `status` transitions only from allowed states.
2. Replace Math.random code generator with collision-resistant approach (e.g., sequence table or hashed UUID).
3. Add integration tests verifying PNG/QR binary integrity.
4. Document redeem RPC ensuring atomic update + event insertion.
5. Add cron (Edge Function) to expire vouchers automatically and log event.

## Validation Steps
- Issue voucher, send, redeem on staging; inspect DB to confirm events recorded and audit log entry present.
- Attempt redeem from different station; expect failure.
- Run double redeem test (redeem twice quickly); ensure second fails.

