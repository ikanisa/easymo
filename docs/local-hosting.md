# Local Hosting Guide

This guide explains how to run the EasyMO admin app and Supabase-backed API
without Vercel. It assumes macOS or Linux with Node.js 18+, pnpm 8+, and the
Supabase CLI installed.

## Install dependencies

```bash
pnpm install
```

This installs workspace dependencies declared in `pnpm-workspace.yaml`, including
shared packages that the admin console, Edge Functions, and supporting services
consume.

## Build and serve the Next.js bundle

```bash
pnpm build
pnpm start
```

- `pnpm build` compiles the Next.js app, prepares Edge Function artifacts, and
  verifies TypeScript types.
- `pnpm start` runs the compiled server on the port declared by `PORT` (defaults
  to `3000`). Use this mode behind a reverse proxy to mimic production.

For development with hot reload, continue using:

```bash
pnpm dev
```

## Reverse proxy placeholders

When self-hosting, terminate TLS and handle caching/compression at the proxy
layer. Example Nginx snippet:

```nginx
server {
  listen 443 ssl;
  server_name admin.easymo.local;

  ssl_certificate     /etc/ssl/certs/your_cert.pem;
  ssl_certificate_key /etc/ssl/private/your_key.pem;

  location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_set_header   Host $host;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
  }
}
```

Adjust the upstream host/port to match your `.env` configuration. Remember to
add the proxy hostname to Supabase’s allowed CORS origins and redirect URLs.

## Cron job alternatives

Vercel’s scheduled functions are not available when self-hosting. Consider:

- **Supabase Scheduled Functions** – define cron triggers via the Supabase CLI
  (`supabase functions deploy` + `supabase cron schedule`).
- **Systemd timers / launchd jobs** – call the relevant Edge Function endpoint
  or invoke scripts inside `scripts/` on a schedule.
- **External schedulers** – e.g. GitHub Actions, Airflow, or a managed cron
  service calling your exposed webhook.

Disable in-app cron toggles (`CART_REMINDER_CRON_ENABLED`,
`ORDER_PENDING_REMINDER_CRON_ENABLED`, `NOTIFICATION_WORKER_CRON_ENABLED`) if
another scheduler will drive the workflow.
