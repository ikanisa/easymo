# WA Webhook Refactor Notes (Phase 0)

## Current Layout
```
wa-webhook/
  config.ts
  deps.ts
  index.ts                     # entrypoint
  router/                      # message type routers
  exchange/                    # flow exchange actions/helpers
  flows/                       # domain-specific flows (wallet, mobility, insurance, etc.)
  notify/                      # notification queue helpers
  observe/                     # logging
  rpc/                         # Supabase RPC wrappers
  state/                       # profile/session state helpers
  utils/                       # misc helpers (text, momo, qr, etc.)
  wa/                          # WhatsApp-specific helpers (ids, client)
  vouchers/
```

## Immediate Issues
- Cross-domain coupling: flows call into RPC + Supabase directly; lack service layer boundaries.
- Legacy flows under `flows/*.ts` with README placeholders (e.g., `flows/dinein`) — need audit.
- Tests exist only for `notify/sender` and `utils/ussd`; no coverage for router/flows.
- Logging includes raw WA IDs in some modules (need consistent masking).

## Refactor Targets
1. **Module boundaries**
   - `/domains/<name>` (wallet, mobility, insurance, marketplace, vouchers).
   - `/services` (Supabase data access, notifications, OCR, mobility matching).
   - `/inbound` vs `/flows` separation for plain WA vs Flow API.
2. **Dependency injection**
   - Pass Supabase clients + config objects instead of importing singletons for testability.
3. **Testing**
   - Add integration tests per domain (mock Supabase + WA payloads).
   - Ensure router dispatch logic has coverage (text/location/buttons).
4. **Documentation**
   - Generate `FLOW_DOC.md` from `flows/json/*.json` to keep definitions in sync.
   - Remove deprecated JSON flow files (e.g., `flow.vend.staff.v1.legacy.bak`).
5. **Cleanup tasks**
   - Remove `wa-webhook.local.*` temp directories.
   - Audit `flows/dinein` new modules before enabling.
   - Ensure `observe/log.ts` centralizes structured logging.
