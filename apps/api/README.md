# Voice API

NestJS service powering Twilio + WhatsApp realtime flows.

## Development

- `pnpm --filter voice-api dev` – run the service with `ts-node-dev`.
- `pnpm --filter voice-api build` – compile TypeScript to `dist/`.
- `pnpm --filter voice-api test` – builds shared packages and runs the Jest suite.

### Environment

Create `apps/api/.env` (or export variables) with:

```
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=super-secret
JWT_SIGNING_KEY=dev
BRIDGE_SHARED_SECRET=dev
```

In tests we auto-seed fallback values via `jest.setup.ts`, so CI/local runs don’t require secrets. Update that file if new required env vars are added.

### Notable scripts

- `scripts/test-functions.sh` – curls Supabase Edge functions (needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EASYMO_ADMIN_TOKEN` set).
- `scripts/mock-voice-data.ts` – seeds `voice_calls` & `voice_followups` using Supabase Service Role creds.
