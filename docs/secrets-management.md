# Secrets Management & Rotation

This project now sources all operational credentials from the Supabase Secrets Manager (or the
platform-specific secret store exposed to the Edge runtime). Secrets are never bundled at build time
and are resolved per-request through the new runtime bindings helper introduced in
`supabase/functions/_shared/secrets.ts`.

## Migrating environment variables

1. Export any legacy `.env` values that were previously injected locally.
2. For Supabase Edge Functions use the CLI to load secrets into the managed store:
   ```bash
   supabase secrets set --project-ref <project-ref> \
     SUPABASE_SERVICE_ROLE_KEY="..." \
     REVOLUT_WEBHOOK_SECRET="..." \
     MOMO_SMS_HMAC_SECRET="..."
   ```
3. For platforms that expose secrets as bindings, ensure the keys follow one of the recognised
   prefixes (`SUPABASE_SECRET_`, `SUPABASE_SECRETS_`, `SB_SECRET_`). The runtime helper
   automatically checks these prefixes before falling back to the plain environment variable name
   for backwards compatibility.
4. Deploy the updated configuration. Edge functions will re-resolve secrets on the next invocation
   thanks to the per-key cache TTL (configurable via `SECRET_CACHE_TTL_MS`).

## Runtime access pattern

- `getSecret`, `requireSecret`, and `getSecretPair` resolve secrets for every invocation, enabling
  key rotation without redeploying functions.
- All service clients (admin helpers, shared Supabase client, and webhooks) now rehydrate
  credentials on a short cache interval to accept rotated keys without downtime.
- Webhook verifiers (Revolut, QR, and MoMo SMS) accept both the active secret and an optional
  `*_PREVIOUS` key so traffic remains valid while clients update.

## Network and authentication safeguards

- Each webhook now enforces either a validated signature (Revolut, MoMo SMS, QR codes) or an
  authenticated admin token before processing requests.
- The MoMo SMS endpoint additionally requires an IP allow-list or signature key; if neither is
  configured the function returns `503` to avoid accidental exposure.

## Automated rotation

Use the helper script to stage and rotate keys with minimal downtime:

```bash
./scripts/rotate-supabase-secret.ts \
  --name REVOLUT_WEBHOOK_SECRET \
  --value $(openssl rand -hex 32) \
  --previous "$CURRENT_SECRET" \
  --project $SUPABASE_PROJECT_ID
```

The script issues a `PATCH` request to the Supabase management API, keeps the previous key available
under the `_PREVIOUS` suffix (when provided), and supports `--dry-run` for audit or CI pipelines.
Schedule it through your secrets automation (e.g. GitHub Actions or HashiCorp Vault) to rotate keys
on the cadence defined in your security policy.

### Recommended cadence

| Secret scope                | Rotation frequency   | Notes                                            |
| --------------------------- | -------------------- | ------------------------------------------------ |
| Webhook shared secrets      | Every 30 days        | Accepts `_PREVIOUS` fallback automatically       |
| Service role / admin tokens | Every 90 days        | Cached for 5 minutes to allow seamless refresh   |
| Third-party API keys        | Follow provider SLAs | Update `_PREVIOUS` simultaneously when supported |

After rotation, existing function instances will refresh credentials once the cache TTL expires or
on the next cold start. You can force an immediate refresh by redeploying the function or
invalidating the cache via `clearSecretCache` during tests.
