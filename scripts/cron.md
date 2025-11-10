# Cron Job Manual Scheduling

Several scheduled tasks in the EasyMO workspace need to invoke Supabase Edge Functions on a timer. Since the application is now hosted locally (no longer using Netlify), operators must schedule these jobs manually using system cron or similar scheduling tools when production automation is required.

## Functions that require scheduled execution

The following Supabase Edge Functions were designed to run on a timer. They remain deployable and now require an external scheduler (cron, systemd timers, etc.):

- `availability-refresh`
- `baskets-reminder`
- `notification-worker`
- `recurring-trips-scheduler`
- `housekeeping`

Each function still accepts an HTTP trigger (see the respective handler in `supabase/functions/<name>/index.ts`) so you can continue to run them ad-hoc with `curl` or the Supabase CLI.

## Replacement options

### Linux / container hosts (cron)

1. Create a script that authenticates with Supabase and calls the required function endpoint, for example:
   ```bash
   #!/usr/bin/env bash
   curl -fsS \
     -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
     -H "Content-Type: application/json" \
     "${SUPABASE_FUNCTION_URL}/availability-refresh"
   ```
2. Register the script with `crontab -e` using the appropriate cadence (refer to the `CRON_EXPR` constant inside each function for guidance).

### macOS laptops (launchd)

1. Wrap the same `curl` invocation in a shell script under `~/Library/Scripts/`.
2. Add a `LaunchAgent` plist (e.g. `com.easymo.availability-refresh.plist`) that points to the script and mirrors the cron expression using `StartInterval` or `StartCalendarInterval`.
3. Load the agent with `launchctl load ~/Library/LaunchAgents/com.easymo.availability-refresh.plist`.

> ℹ️  These instructions only document the migration path; no automation has been committed in this repository. Remember to rotate and store any tokens used by cron/launchd scripts securely (e.g. in 1Password or your infrastructure secret store).
