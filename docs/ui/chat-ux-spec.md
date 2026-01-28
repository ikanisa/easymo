# Chat-First UX Specification

This spec describes the mobile-first, chat-only experience for **Workflow WEB-1** where Moltbot drives an anonymous marketplace session via validated tool plans.

## Experience goals
- **One conversation**: There are no traditional forms; every data point comes through a single messenger canvas powered by Moltbot questions and user replies.
- **Anonymous session**: Behind the scenes the app signs in with `supabase.auth.signInAnonymously()`, creates/updates `web_sessions`, and keeps `last_seen_at` fresh to enforce RLS policies.
- **Feature flag control**: The entire experience is gateable through `VITE_FEATURE_WEB_MARKETPLACE_CHAT` (default `false`). When the flag is off the UI still loads but shows a banner and pauses publishing actions until the flag is enabled.

## Sequence
1. **Launch & identity** – On first load the client signs in anonymously, creates `web_sessions`, and inserts a `market_posts` draft with `status = draft`. The hero explains the Moltbot workflow without exposing any backend jargon.
2. **Conversational capture** – The user types natural language (or taps quick replies) and Moltbot parses the message for `type`, `category`, `price`, `location`, etc. Each message immediately updates the draft (`update_post_fields`) and Moltbot echoes either a clarification (“Please share a price range”) or a confirmation summary.
3. **Clarification guardians** – Moltbot caps clarifications at three per turn, reusing the contract’s `ask_user` semantic. The UI marks clarification replies with an orange border and limited tone to keep the chat lightweight.
4. **Post-once-ready** – When the user says “post”, “publish”, or similar and the draft has enough data (type, price range, location), the UI sends the `post_now` transition, updates the status badge to “posted,” and triggers the matching/notification pipeline before rendering results.
5. **Context packs** – After posting the UI pulls `match_suggestions`, `external_feed_items`, and `web_notifications` for the new post so Moltbot can show cards, discovery links, and queued alerts without additional prompts.
6. **Discovery discipline** – External feeds are surfaced as links with source/ confidence metadata but never presented as “inventory” statements. Any external call is audited and obeys the two-call budget per post.

## UI considerations
- **Chat window**: Floating bubbles animate in with a gradient palette, with user bubbles tinted bright teal and Moltbot bubbles presented with a softened surface. Clarification bubbles have a warning border.
- **Quick replies**: Chips for intents (buy, sell, price, location) keep the conversation fast and are styled as accent chips.
- **Input area**: Persistent textarea + send button (desktop + mobile friendly) mimics a messenger and disables the send action while the feature flag is off.
- **Status & panels**: Right column surfaces the draft status, match cards (score + explainable reasons), discovery links, and notification queue so the chat never loses the broader context.
- **Responsive / PWA ready**: The layout collapses to a single column on narrow screens, fonts (Space Grotesk + Manrope) are expressive, and the background uses gradients + subtle glow to avoid flat visuals.

## Failure modes
- If Supabase sign-in or draft updates fail, the app logs an error and keeps the user in the chat while showing a minimal banner (console logging suffices for now).
- Moltbot clarifications keep the UI from firing `post_now` until the necessary fields exist (type, price, location).

By keeping every interaction inside the chat canvas and surfacing matching results/notifications as contextual cards, this UX keeps the experience mobile-first, guided by Moltbot, and fully anonymous.
