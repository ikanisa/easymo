# Troubleshooting

## Common Checks

```bash
# Environment checks
pnpm env:check

# Supabase status
supabase status

# Recent edge function logs
supabase functions logs wa-webhook-core --limit 50
```

## Common Issues

### Env vars missing
- Ensure `.env` exists and is populated.
- Never put secrets in `NEXT_PUBLIC_*` or `VITE_*`.

### Supabase not running locally
- Run `supabase start` and re-apply migrations with `supabase db reset`.

### Webhook verification failures
- Confirm `WA_VERIFY_TOKEN` and `WHATSAPP_APP_SECRET` match Meta settings.
- Ensure signature verification is enabled in production.

### Cloud Run service failing

```bash
gcloud run services logs read <service> --limit=50
```

### Admin app build errors

```bash
pnpm run build:deps
pnpm --filter @easymo/admin-app run build
```
