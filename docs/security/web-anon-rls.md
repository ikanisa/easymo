# Anonymous Web RLS Guidance

This page codifies the RLS posture for the Anonymous Web Marketplace (Workflow WEB-1) so every reader understands how our Supabase tables enforce anonymous-only actions without exposing private data.

## Authentication flow
1. **Anonymous sign-in**: The PWA calls `supabase.auth.signInAnonymously()` on first load. This returns a minimal `auth.uid()` value (anonymized user ID) with `role = 'authenticated'`.
2. **CAPTCHA + rate limiting**: The UI should gate the anonymous sign-in behind an abuse control (captcha challenge plus the bucketized rate limits we already apply to public flows). This prevents high-volume session creation.
3. **Session row**: After the sign-in, the client creates or fetches a `web_sessions` row keyed by `anon_user_id = auth.uid()` and captures optional `device_fingerprint_hash`, `language`, etc. The session persists across refreshes and anchors RLS ownership.

## Table-specific RLS rules
- **`web_sessions`**: Only the anonymous owner (`anon_user_id = auth.uid()`) can `SELECT`, `UPDATE`, or `DELETE` their own session row. Inserts require the same `anon_user_id`. The service role bypass policy for backend tooling.
- **`market_posts`**: Every `market_posts` write (insert/update) must reference a session that belongs to `auth.uid()` (enforced via the helper `web_session_owned_by`). Reads are limited to those same owned posts plus the service role. This guarantees drafts/posted requests cannot be modified by other sessions.
- **`market_listings`**: Public, authenticated reads are limited to rows where `is_active` is `true` and the underlying `market_posts.status = 'posted'`. Writes, deletes, and inserts are only service-role-facing to keep derived listings sane.
- **`match_suggestions`**: Owners can `SELECT` suggestions as long as the `match_suggestions.post_id` belongs to one of their `market_posts`. The service role alone inserts and updates rows so Moltbot tooling can write deterministic scores and reasons.
- **`web_notifications`**: Owners can read notifications when `target_type` is `seller_session`/`buyer_session` and `target_id` maps to their session. Otherwise notifications are service-role-only so multi-channel delivery happens server-side.
- **`external_feed_items`**: Authenticated reads are wide-open so the chat UI can show discovery links, but inserts must flow through the service role (tools that honor the external discovery budget).

## Enforcement notes
- **Feature flags**: Feature flag ``WEB_MARKETPLACE_CHAT`` (or similar) should default to `enabled = false` until the rollout is ready. This lets us gate anonymous web features without turning off existing flows.
- **Audit & abuse**: Every tool write (posts, matches, notifications, discovery calls) logs to our audit stack and checks the hourly rate limit per `web_sessions`. If thresholds are exceeded or prohibited keywords appear, we `moderate_or_block` the session and log a `moderation_events` row (see future Phase 9 instructions).
- **Session hygiene**: Clients should update `web_sessions.last_seen_at` at least once per minute of usage to help us detect stale/bot sessions.

By following the patterns above, we keep anonymous users siloed to their own drafts while still showing only curated listings and discovery links to the broader marketplace.
