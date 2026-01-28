---
description: "WEB-1: Anonymous Web Marketplace (Chat-First) Managed by Moltbot (Additive Only)"
---

# Workflow WEB-1 — Anonymous Web Marketplace (Chat-First) Managed by Moltbot

## Non-negotiable Constraints
- **Additive only**: do not delete/rename existing tables, tools, endpoints, or WhatsApp flows
- **Anonymous web access** uses Supabase **Anonymous Sign-Ins** (no email/phone required), with abuse controls (captcha + rate limits)
- Moltbot is the **brain**: it decides questions, matching, ranking, and what notifications to send
- Moltbot never talks to users directly; it outputs **validated JSON plans** and the backend executes via tools
- External discovery (web/maps/social) is **discovery only**, not inventory truth
- Feature flags default OFF for new web features

---

## Outcomes
1. Web/PWA "community marketplace" with chat-first posting (buy/sell) and anonymous sessions
2. Supabase schema extensions for web posts, listings, match suggestions, notifications, external feed items
3. Moltbot skill `community-marketplace-web` + output contract schema
4. Tools for CRUD, matching, ranking, notifications, and external discovery (web/maps/social)
5. Safety: spam prevention, content moderation queues, auditability, and strict rate limits
6. E2E tests: anonymous user journeys + matching + notifications + external feed inclusion

---

## Phase 1 — Product Data Model (Supabase)

### Core Tables (additive migrations 0100-0106)
- `web_sessions` — anonymous session tracking
- `market_posts` — buy/sell requests from chat
- `market_listings` — public listings derived from posts
- `match_suggestions` — ranked match results
- `web_notifications` — notification queue
- `external_feed_items` — web/maps/social discovery results
- `product_listings` — anonymous product/service listings
- `listing_inquiries` — buyer inquiries
- `listing_verification_requests` — verification workflow

---

## Phase 2 — Auth & Security

### Anonymous Sign-In
- On first load: `signInAnonymously()` to obtain session
- Create `web_sessions` row with `anon_user_id`
- Rate limiting per IP/session
- Recommended: captcha for anonymous sign-ins

### RLS Posture
- Anon user can CRUD only their own session rows
- Public read allowed only for posted listings (sanitized fields)
- Sensitive tables remain server-only

---

## Phase 3 — Moltbot Skill + Output Contract

### Output Contract Actions
Location: `docs/moltbot/web-marketplace-output-contract.v1.json`

| Action | Description |
|--------|-------------|
| `ask_user` | Request missing information (max 3 per turn) |
| `update_post` | Write captured fields to Supabase |
| `post_now` | Move draft → posted |
| `create_listing_draft` | Create product/service listing |
| `update_listing_fields` | Update listing fields |
| `publish_listing` | Publish listing |
| `list_published_listings` | Browse listings |
| `create_listing_inquiry` | Buyer contacts seller |
| `request_listing_verification` | Request verification |
| `suggest_matches` | Generate match suggestions |
| `notify_top_targets` | Queue notifications (max 10) |
| `show_feed_options` | Present external feed items as links |
| `moderate_or_block` | Spam/abuse control |

### Skill Package
Location: `skills/community-marketplace-web/`
- `prompt.md` — core instructions
- `policies.md` — safety policies
- `examples.json` — validation examples

---

## Phase 4 — Tooling Layer

### Web Tools (server-side)
Location: `src/tools/web/`

- `createOrGetSession.ts` — session management
- `createDraftPost.ts` — create draft post
- `updatePostFields.ts` — update post fields
- `setPostStatus.ts` — status transitions
- `fetchPostContext.ts` — context pack builder
- `createListingDraft.ts` — create listing
- `updateListingFields.ts` — update listing
- `publishListing.ts` — publish listing
- `listPublishedListings.ts` — browse listings
- `createListingInquiry.ts` — create inquiry
- `requestListingVerification.ts` — request verification
- `queryInternalMatches.ts` — find matches
- `rankMatches.ts` — rank with reasons
- `writeMatchSuggestions.ts` — persist suggestions
- `queueNotifications.ts` — queue notifications
- `dispatchNotifications.ts` — send notifications

---

## Phase 5 — External Feeds

### Discovery Tools (gated)
- `discovery.web_search_items` — OpenAI web search / Gemini grounding
- `discovery.maps_places_items` — Google Maps Places
- `discovery.social_profile_items` — Social profile lookup

### Guardrails
- Budgets per post (max 2 external calls per source)
- No inventory/price claims unless confirmed
- Store audit events for each call

---

## Phase 6 — Web App (Mobile-first PWA)

### UI Architecture
Location: `apps/web/`

- Single chat interface (like a messenger)
- Message types: user text, AI question bubbles, quick replies, match cards, external links
- No classic forms; all data entry is conversational

### Flow
1. On load: anonymous sign-in
2. Create draft post
3. User chats: "I want to buy… / sell…"
4. Backend sends context pack → Moltbot → tool plan → execute updates
5. When posted: generate matches + show top suggestions
6. Queue notifications to top 10

### Browse Tabs
1. **Vendors** — verified vendors only (from `vendors` table)
2. **Listings** — published listings (verified + unverified with badge)
3. **Requests** — market posts (buy/sell requests)

---

## Phase 7 — Notifications

### Web Notifications
- In-app notifications inbox
- Realtime updates via Supabase Realtime

### WhatsApp Notifications (opted-in only)
- Only for vendors/users who explicitly opted in
- Reuse existing `whatsapp.send_message` tool

---

## Phase 8 — Matching & Ranking

### Baseline Scoring
- Category match
- Keyword overlap
- Price overlap (buy max >= sell min)
- Distance proximity (if geo)
- Recency
- Seller responsiveness

### Moltbot Adjustments
- Score adjustments limited to ±15%
- Must provide reasons
- Cannot exceed 10 suggestions

---

## Phase 9 — Moderation + Abuse Control

### Moderation Queue
- Table: `moderation_events`
- Triggers: spam bursts, prohibited categories, harassment
- Actions: moderate_or_block → block posting temporarily
- Rate limit: post creation per session per hour

---

## Phase 10 — E2E Tests

### Golden Scenarios
Location: `test/e2e/scenarios/web/`

1. Anonymous user creates buy post via chat
2. Moltbot captures fields and posts
3. System suggests matches + notifies top 10 internal sellers
4. External feeds displayed as links
5. Abuse/spam blocked

---

## Definition of Done
- Anonymous web user can buy/sell via chat-only UI
- Moltbot updates Supabase fields through validated tool plans
- Matching + ranking produces explainable top suggestions and notifies top 10
- External feed items appear as URLs (discovery only)
- All new features are feature-flagged and additive
