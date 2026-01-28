---
description: "PHASE F — Web Marketplace Core (anonymous chat-first PWA)."
---

# PHASE F — Web Marketplace Core

## F1 — Web tables + RLS
Migrations:
- web_sessions
- market_posts
- market_listings
- match_suggestions
- web_notifications
- external_feed_items
- product_listings
- listing_inquiries
- listing_verification_requests
- RLS for anonymous user self-access + public posted reads

**Acceptance**:
- migrations apply cleanly
- anon user can CRUD own drafts/posts
- public can read posted listings only

---

## F2 — Anonymous auth bootstrap
Implement:
- signInAnonymously + create_or_get_session tool
- rate limiting per IP/session
- optional captcha enforcement

**Acceptance**:
- opening site creates anon session
- refresh keeps session stable
- session row updated `last_seen_at`

---

## F3 — Web Moltbot skill + output contract
Create:
- skill `community-marketplace-web`
- output contract `web-marketplace-output-contract.v1.json`

Actions:
- ask_user, update_post, post_now
- create_listing_draft, update_listing_fields, publish_listing
- list_published_listings, create_listing_inquiry, request_listing_verification
- suggest_matches, notify_top_targets, show_feed_options
- moderate_or_block

**Acceptance**:
- examples validate against contract schema
- injection examples do not cause forbidden actions

---

## F4 — Tools for CRUD + context pack
Implement tools:
- web.create_or_get_session
- web.create_draft_post
- web.update_post_fields
- web.set_post_status
- web.fetch_post_context
- web.create_listing_draft
- web.update_listing_fields
- web.publish_listing
- web.list_published_listings
- web.create_listing_inquiry
- web.request_listing_verification

**Acceptance**:
- create draft → update fields → publish works end-to-end via tools
- audit_events written for each tool call

---

## F5 — Matching + ranking + notifications
Implement:
- web.query_internal_matches
- web.rank_matches (baseline scorer, Moltbot adjust ±15% max)
- web.write_match_suggestions
- web.queue_notifications (top 10)

Constraints:
- max 10 suggestions
- reasons array required

**Acceptance**:
- buy post produces ranked suggestions
- suggestions are explainable and capped
- notifications queued and visible in UI

---

## F6 — Chat-first PWA UI
Build:
- single chat interface (mobile-first)
- message bubbles + quick replies
- cards for match suggestions
- "External options" section
- Listings tab (products/services)
- Vendors directory (verified only)

**Acceptance**:
- no forms required to create a post
- user can complete buy/sell post via chat
- suggestions appear
- vendors tab shows only verified

**Rollback**:
- disable web routes/flags
