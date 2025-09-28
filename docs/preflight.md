# WA Webhook Preflight Checklist

- [ ] Supabase service role and anon keys configured (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] WhatsApp Cloud API secrets present (`WA_PHONE_ID`/`WHATSAPP_PHONE_NUMBER_ID`, `WA_TOKEN`/`WHATSAPP_ACCESS_TOKEN`, `WA_APP_SECRET`/`WHATSAPP_APP_SECRET`, `WA_VERIFY_TOKEN`/`WHATSAPP_VERIFY_TOKEN`).
- [ ] Storage buckets created: `menu-source-files`, `insurance-docs`.
- [ ] Database migrations applied through `20251003160000_phase_a_legacy.sql`.
- [ ] Seed data loaded for wallet earn/redeem options (optional).
- [ ] Edge function `wa-webhook` deployed and runtime assertions pass (`assertRuntimeReady`).
