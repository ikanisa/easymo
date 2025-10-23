# Local Caddy + Cloudflare Tunnel Setup

This guide explains how to run the admin app behind a local Caddy server exposed through a Cloudflare Tunnel. Follow the steps in order so that the admin experience works with Cloudflare Access and Supabase redirects.

## 1. Install prerequisites

1. Ensure you are in the repo root and install shared dependencies:
   ```bash
   make deps
   ```
2. Install the Caddy binary. On macOS you can use Homebrew (`brew install caddy`); on Linux download the latest release from [caddyserver.com/download](https://caddyserver.com/download) and place the binary on your `PATH`.
3. Install `cloudflared` by following the [official instructions](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/). Authenticate the tunnel client with `cloudflared login` so it can create tunnels for your Cloudflare account.

## 2. Configure local services

1. Copy `.env.example` to `.env` if you have not already done so and fill in the required secrets. Ensure `ADMIN_HOSTNAME` is set to the hostname you will expose through Cloudflare (e.g. `admin.sacco-plus.com`).
2. Update `infrastructure/caddy/Caddyfile` (or your local override) with a site block matching `ADMIN_HOSTNAME`. Proxy requests to the local admin app port, for example:
   ```caddyfile
   admin.sacco-plus.com {
       reverse_proxy localhost:4200
   }
   ```
3. Start Caddy in the background: `caddy run --config infrastructure/caddy/Caddyfile`.
4. Start the admin web application with the usual local command (`pnpm --filter admin-app dev` or `npm run dev -- --filter admin-app`).

## 3. Create and run the Cloudflare Tunnel

1. Create a named tunnel:
   ```bash
   cloudflared tunnel create easymo-admin-local
   ```
2. Store the generated credentials file in a safe location (for example `~/.cloudflared/easymo-admin-local.json`).
3. Configure the tunnel to route the public hostname to your local Caddy service by editing `~/.cloudflared/config.yaml`:
   ```yaml
   tunnel: easymo-admin-local
   credentials-file: /home/<user>/.cloudflared/easymo-admin-local.json

   ingress:
     - hostname: admin.sacco-plus.com
       service: https://localhost:443
     - service: http_status:404
   ```
   Adjust the `service` URL if Caddy is listening on a different port. For example, use `http://localhost:80` if you terminate TLS at Cloudflare and let Caddy listen on plain HTTP, or `https://localhost:8443` when running Caddy on an unprivileged HTTPS port.
4. Run the tunnel:
   ```bash
   cloudflared tunnel run easymo-admin-local
   ```

## 4. Configure Cloudflare Access policies

1. Open the Cloudflare dashboard and navigate to **Zero Trust → Access → Applications**.
2. Create (or update) an Access application for `https://admin.sacco-plus.com` with the **Self-hosted** type.
3. Add an access policy granting your engineering group or individual emails permission to reach the site. For example:
   - Include rule: *Emails ending in* `@easymo.com`.
   - Optional: Add service tokens for CI or testing accounts.
4. Save the application and verify that visiting the hostname enforces the Access login flow.

## 5. Update Supabase redirect URIs

1. Sign in to the Supabase project that backs the admin app.
2. Navigate to **Authentication → URL Configuration**.
3. Add `https://admin.sacco-plus.com/auth/v1/callback` (and any additional required callback paths) to the list of redirect URLs.
4. Save the configuration and redeploy auth settings if prompted.

## 6. Rollback procedure

If you need to revert the setup:

1. Stop the tunnel: `cloudflared tunnel stop easymo-admin-local` and optionally delete it with `cloudflared tunnel delete easymo-admin-local`.
2. Stop Caddy: interrupt the `caddy run` process or use `pkill caddy`.
3. Remove the hostname and redirect entries from Cloudflare Access and Supabase if they should no longer be exposed.
4. Reset any local `.env` changes if you copied secrets specifically for the tunnel (e.g. by re-copying `.env.example`).

Following these steps lets you stand up a secure Cloudflare-tunneled admin environment locally, while maintaining an easy rollback path.
