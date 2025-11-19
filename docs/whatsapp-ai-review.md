# WhatsApp & AI Agent Reliability Review

## Summary of Known Break Points

- **Webhook regressions already fixed but still at risk**: Prior deep review identified critical
  failures in duplicate menu IDs, unsafe OpenAI array access, and missing `BACK_HOME` handler. These
  were fixed, yet they remain fragile areas that can resurface if new menus or embedding calls are
  added without guardrails. 【F:WA_WEBHOOK_DEEP_REVIEW_2025-11-15.md†L11-L128】
- **AI agents failing due to deployment gaps**: Job Board AI and Property AI chats break in
  production when the Supabase Edge cache is stale or when the `agent-property-rental` function is
  not deployed. Code paths are sound; availability depends on
  redeployment. 【F:AI_AGENT_ISSUES_README.md†L5-L110】
- **Large monolithic webhook slowing responses**: The `wa-webhook` edge function ships ~38k
  LOC/453kB, causing cold-start latency and all-or-nothing failures that surface as timeouts or
  stuck conversations. 【F:SUPABASE_SCALABILITY_AUDIT.md†L20-L131】
- **Database surface area risk**: 1,085 DB functions and 20 tables without RLS increase the odds of
  permission errors during chats (e.g., “Can't search right now”) and raise security
  risk. 【F:SUPABASE_SCALABILITY_AUDIT.md†L11-L83】

## Root Causes

1. **Stateful menu IDs without automated validation** lead to duplicated IDs and silent handler
   gaps. 【F:WA_WEBHOOK_DEEP_REVIEW_2025-11-15.md†L11-L61】
2. **Embedding calls assume OpenAI returns data**; empty payloads previously triggered 500s, and
   similar unchecked calls remain. 【F:WA_WEBHOOK_DEEP_REVIEW_2025-11-15.md†L22-L145】
3. **Operational drift in Edge deployments** (cache + missing functions) breaks AI chat flows even
   when code is correct. 【F:AI_AGENT_ISSUES_README.md†L5-L110】
4. **Monolithic function and broad DB surface** slow cold starts and increase permission/query
   failures that manifest as stalled
   chats. 【F:SUPABASE_SCALABILITY_AUDIT.md†L20-L131】【F:SUPABASE_SCALABILITY_AUDIT.md†L41-L83】

## Recommendations

### WhatsApp Webhook

- Add CI step to run `node check_duplicate_ids.mjs` and fail on new ID
  collisions. 【F:WA_WEBHOOK_DEEP_REVIEW_2025-11-15.md†L48-L165】
- Enforce guarded OpenAI responses (null/length checks) via shared helper; audit remaining calls
  beyond the two fixed sites. 【F:WA_WEBHOOK_DEEP_REVIEW_2025-11-15.md†L22-L146】
- Implement structured logging and reduce monolith by deploying existing split functions
  (`wa-webhook-*`) and routing traffic through
  `wa-webhook-core`. 【F:SUPABASE_SCALABILITY_AUDIT.md†L41-L131】

### AI Agents (Waiter, Real Estate, Job Board)

- Automate redeploys of `wa-webhook` and `agent-property-rental` after dependency or config changes
  to avoid cache-induced outages. 【F:AI_AGENT_ISSUES_README.md†L11-L110】
- Add lightweight health pings per agent (e.g., invoke `/health` endpoints) and surface failure
  metrics in Prometheus to catch stuck agents
  sooner. 【F:WA_WEBHOOK_DEEP_REVIEW_2025-11-15.md†L130-L152】

### Supabase Schema & Security

- Review and enable RLS on the 20 listed tables; add automated lint to block new tables without
  RLS. 【F:SUPABASE_SCALABILITY_AUDIT.md†L11-L83】【F:SUPABASE_SCALABILITY_AUDIT.md†L160-L174】
- Trim unused DB functions and consolidate overlapping RPCs to cut planner overhead and reduce
  failure modes during chat queries. 【F:SUPABASE_SCALABILITY_AUDIT.md†L41-L83】

## Immediate Action Plan

1. **Redeploy critical functions**:
   `supabase functions deploy wa-webhook wa-webhook-core wa-webhook-marketplace wa-webhook-jobs wa-webhook-ai-agents agent-property-rental --no-verify-jwt`.
   (Addresses cache and missing function issues.) 【F:AI_AGENT_ISSUES_README.md†L11-L110】
2. **Add CI guardrails**: wire `check_duplicate_ids.mjs` and embedding response checks into pipeline
   before deploy. 【F:WA_WEBHOOK_DEEP_REVIEW_2025-11-15.md†L48-L146】
3. **Kick off webhook split**: migrate routing into `wa-webhook-core` and activate per-domain edge
   functions to shrink cold-start time. 【F:SUPABASE_SCALABILITY_AUDIT.md†L90-L131】
4. **Secure schema**: enable RLS on missing tables and schedule function cleanup sprint to reduce
   1,085-function
   footprint. 【F:SUPABASE_SCALABILITY_AUDIT.md†L11-L83】【F:SUPABASE_SCALABILITY_AUDIT.md†L160-L174】
