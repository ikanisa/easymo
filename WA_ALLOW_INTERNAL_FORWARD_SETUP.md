# WA_ALLOW_INTERNAL_FORWARD Setup

## ⚠️ Important: Correct Value

`WA_ALLOW_INTERNAL_FORWARD` must be set to the string `"true"`, **NOT** the app secret value.

## Correct Setup

```bash
supabase secrets set WA_ALLOW_INTERNAL_FORWARD=true
```

## Incorrect Setup (Will Not Work)

```bash
# ❌ WRONG - Don't set it to the app secret
supabase secrets set WA_ALLOW_INTERNAL_FORWARD=your-app-secret-value
```

## How to Verify

The code checks:
```typescript
(Deno.env.get("WA_ALLOW_INTERNAL_FORWARD") ?? "false").toLowerCase() === "true"
```

So the value must be:
- `"true"` (case-insensitive, so `"TRUE"`, `"True"`, `"true"` all work)
- Any other value (including app secret) will be treated as `false`

## How to Check Current Value

You can't see the actual value in Supabase UI (it's encrypted), but you can:

1. **Check if it's set correctly** by testing the webhook:
   - If signature verification works for internal forwards → it's set correctly
   - If you still see `MOBILITY_SIGNATURE_MISMATCH` → it's not set to `"true"`

2. **Update it to the correct value:**
   ```bash
   supabase secrets set WA_ALLOW_INTERNAL_FORWARD=true
   ```

## Expected Behavior

### With `WA_ALLOW_INTERNAL_FORWARD=true`:
- Requests from `wa-webhook-core` will bypass signature verification
- You'll see `MOBILITY_AUTH_BYPASS` with `reason: "internal_forward"` in logs
- Webhook will work correctly

### Without it (or with wrong value):
- Internal forwards will fail signature verification
- You'll see `MOBILITY_SIGNATURE_MISMATCH` errors
- Webhook returns 401 Unauthorized

## Quick Fix

If you set it to the wrong value, just update it:

```bash
supabase secrets set WA_ALLOW_INTERNAL_FORWARD=true
```

Then test the webhook again.

