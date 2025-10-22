# Phase 3 – Operational Notes

Short reminders for items that still need owner follow-up after Phase 2.
Update this file as soon as each task is confirmed so the go-live tracker stays
accurate.

---

## GitHub API Tool Authentication

- The in-app “API Tool → GitHub” integration currently fails because no OAuth
  token is configured.
- Action items:
  1. Decide whether to use a GitHub App or personal access token (Fine-grained
     PAT with read-only repo scope is sufficient).
  2. Store the token in Vercel under `GITHUB_API_TOKEN` (or similar).
  3. Update the API tool backend to read the token and authenticate outbound
     requests.
  4. Test fetching a file via the tool and record the success in
     `docs/go-live-readiness.md`.

## CI / Health Checks

- We now rely on `scripts/health-check.mjs` to verify edge function health.
- GitHub Actions now runs the script as part of `.github/workflows/synthetic-checks.yml`
  (`Run Supabase health check`). Populate the following secrets before enabling the schedule:
  - `SUPABASE_API_BASE` → `https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1`
  - `EASYMO_ADMIN_TOKEN` → service token with `admin-health` access
- The job executes daily via the existing `schedule` trigger, so add alerts/webhooks
  if the step fails.
- Local command reference:

  ```bash
  VITE_API_BASE=https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1 \
  ADMIN_TOKEN=${EASYMO_ADMIN_TOKEN} \
  node scripts/health-check.mjs
  ```

  Any non-zero exit should page the on-call engineer.

- Extend the job with follow-up curl calls if needed:

  ```bash
  curl -s -H "x-api-key: $EASYMO_ADMIN_TOKEN" \
    https://lhbowpbcpwoiparwnwgt.supabase.co/functions/v1/admin-stats
  ```

## Deployment Hygiene

- Remember to redeploy both sub-apps (`app/`, `admin-app/`) after updating
  shared secrets. The root project should never be deployed directly.
- Run the Supabase fixture scripts (`admin_panel_core.sql`,
  `admin_panel_marketing.sql`) whenever a fresh environment is created; they
  are idempotent and can be rerun safely.

## Observability Footprint

- Import Grafana dashboards from `dashboards/phase4/*.json` and map them to the
  Prometheus datasource used by the Agent-Core stack.
- Provision Kafka topics defined in `infrastructure/kafka/topics.yaml` ahead of
  marketplace/voice tests so lag panels have data.
- Confirm wallet, ranking, vendor, and buyer services emit structured logs with
  `requestId` and `tenantId`; route them into your log drain for cross-channel
  debugging.

## AI Agents (Preview)

- Marketplace and Operations screens now expose chat widgets for the upcoming AI broker
  and support agents. Responses are stubbed for now.
- Set `VITE_ENABLE_AGENT_CHAT=1` (frontend) and `ENABLE_AGENT_CHAT=1`
  (Supabase Edge) to enable the preview.
- Conversations are stored in `agent_chat_sessions` / `agent_chat_messages` and surfaced
  via the `/agent-chat` Edge Function entry point.
- When the real agent-core service is online, swap the stubbed responses for live calls.

## Tracking

- Record completion of each item in `docs/go-live-readiness.md`.
- If an item is intentionally deferred, document the rationale and the new
  target date here.
