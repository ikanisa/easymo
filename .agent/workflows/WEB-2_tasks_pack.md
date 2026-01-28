---
description: "WEB-2: Task Pack for Chat-First Anonymous Web Marketplace (Additive Only)"
---

# WEB Tasks Pack — Chat-First Anonymous Web Marketplace

## Global Rules
- Additive only (no renames/deletes of existing assets)
- All new features behind flags default OFF
- Moltbot outputs validated JSON; backend executes via tools
- No cold WhatsApp outreach to external (non-opted-in) vendors

---

## Task WEB-01 — Supabase Migrations (Core Web Marketplace Tables)

**Create**: `supabase/migrations/0100_web_marketplace_core.sql`

**Tables**:
- `web_sessions`
- `market_posts`
- `market_listings`
- `match_suggestions`
- `web_notifications`
- `external_feed_items`

**Acceptance**:
- migrations apply cleanly
- can insert: session → draft post → match_suggestion → notification → external_feed_item

**Rollback**: revert migration (dev only) + reset dev db

**Status**: ✅ Complete (0100-0106 exist)

---

## Task WEB-02 — Anonymous Auth + Session Bootstrap

**Implement**:
- Web app bootstraps Supabase `signInAnonymously()` and creates/loads `web_sessions`
- Add minimal abuse controls (rate limit by IP/session)

**Files**:
- `apps/web/src/services/supabase.ts`
- `src/web/sessionService.ts`

**Acceptance**:
- opening site creates anon session
- refresh keeps session stable
- session row updated `last_seen_at`

**Rollback**: disable web routes; leave DB intact

**Status**: ✅ Complete

---

## Task WEB-03 — RLS for Anonymous Web

**Create**: `supabase/migrations/0101_web_marketplace_rls.sql`

**Policy**:
- anon user can CRUD only their own `web_sessions` + their own draft/posted `market_posts`
- public read allowed only for sanitized "posted listings" view

**Acceptance**:
- cannot read other users' drafts
- cannot edit other users' posts
- can list posted items

**Rollback**: revert RLS migration (dev only)

**Status**: ✅ Complete

---

## Task WEB-04 — Moltbot Output Contract + Skill Package (Web)

**Create**:
- `docs/moltbot/web-marketplace-output-contract.v1.json`
- `skills/community-marketplace-web/{prompt.md,policies.md,examples.json}`

**Contract Actions**:
- ask_user, update_post, post_now
- create_listing_draft, update_listing_fields, publish_listing
- list_published_listings, create_listing_inquiry, request_listing_verification
- suggest_matches, notify_top_targets, show_feed_options
- moderate_or_block

**Acceptance**:
- examples validate against contract schema
- injection examples do not cause forbidden actions

**Rollback**: disable AI flag for web; keep UI functional

**Status**: ✅ Complete

---

## Task WEB-05 — Web Tool Layer (CRUD + Context Pack)

**Implement tools** (server-side):
- `web.create_or_get_session`
- `web.create_draft_post`
- `web.update_post_fields`
- `web.set_post_status`
- `web.fetch_post_context`

**Files**:
- `src/tools/web/*.ts`
- `src/web/postService.ts`

**Acceptance**:
- create draft → update fields → post_now works end-to-end via tools
- audit_events written for each tool call

**Rollback**: disable web tool endpoints

**Status**: ✅ Complete

---

## Task WEB-06 — Matching + Ranking Engine

**Implement**:
- `web.query_internal_matches`
- `web.rank_matches` (baseline scorer)
- `web.write_match_suggestions`

**Constraints**:
- max 10 suggestions
- reasons array required
- Moltbot can adjust score within ±15% only (enforced by backend clamp)

**Acceptance**:
- buy post produces ranked suggestions
- suggestions are explainable and capped

**Rollback**: revert to baseline-only ranking

**Status**: ✅ Complete

---

## Task WEB-07 — Notifications Queue (Top 10) + Web Inbox

**Implement**:
- `web.queue_notifications` to create 10 notifications max
- Web UI notification inbox reads user's notifications

**Acceptance**:
- notifications created and visible in UI
- duplicates prevented by idempotency_key or (post_id,target_id) uniqueness

**Rollback**: disable notification sending; keep suggestions visible

**Status**: ✅ Complete

---

## Task WEB-08 — External Feed Integrations (Gated)

**Implement tools**:
- `discovery.web_search_items`
- `discovery.maps_places_items`
- `discovery.social_profile_items`
- store results in `external_feed_items`

**Constraints**:
- budgets per post (max 2 calls per source)
- no inventory claims
- external items displayed as links only

**Acceptance**:
- with flags OFF: no external calls
- with flags ON: external_feed_items created and shown

**Rollback**: WEB_DISCOVERY_ENABLED=false

**Status**: ✅ Complete

---

## Task WEB-09 — Chat-First PWA UI (Moltbot-Guided)

**Build UI**:
- single chat interface (mobile-first)
- message bubbles + quick replies
- cards for suggestions
- "External options" section

**Backend chat endpoint**:
- receives user message
- builds context pack
- calls Moltbot
- validates output
- executes tools
- returns assistant messages + UI directives

**Acceptance**:
- no forms required to create a post
- user can complete buy/sell post via chat
- suggestions appear

**Rollback**: switch UI to "read-only posted feed" mode

**Status**: ✅ Complete (basic UI in apps/web/)

---

## Task WEB-10 — Moderation + Abuse Controls

**Add**:
- `supabase/migrations/0104_web_moderation_events.sql`
- `moderation_events` + posting rate limits
- moderate_or_block action path

**Acceptance**:
- spam scenario triggers moderation event and blocks session temporarily

**Rollback**: disable moderation enforcement (keep logging)

**Status**: ✅ Complete

---

## Task WEB-11 — E2E Tests (Anonymous Web Journeys)

**Add scenarios**:
1. buy post via chat → posted → suggestions → notifications
2. sell post → matches buyers
3. external feed shown as links
4. spam blocked

**Location**: `test/e2e/scenarios/web/`

**Acceptance**: all pass in CI

**Status**: 🔲 In Progress

---

## Definition of Done
- Anonymous chat-only PWA can post buy/sell
- Moltbot drives capture + matching via validated tool plans
- Top 10 suggestions + notifications work
- External feeds are links only, gated by flags
- Additive-only preserved
