# UI Component Inventory

This section records the reusable pieces for the chat-first PWA so the product/design team can reference how every colored surface, quick reply, and context card maps back to Moltbot’s behavior.

## Layout shell
- `app-shell` – vertical column with generous maximum width, gradient background, and subtle padding so the content never feels cramped on mobile. Implements the primary hero copy, feature flag banner, and splits the view into a chat + context grid.
- `panel` – rounded, glassy containers for the chat column and every right-hand panel. The combination of blurred background and consistent borders keeps the mobile UI legible.

## Chat stream
- `<ChatWindow />` – scrollable list of `message-bubble`s with virtualization via `scrollIntoView`. User bubbles are neon green to match the brand while Moltbot bubbles are bordered in charcoal. Clarification tones introduce an orange border.
- `message-bubble` states – the CSS attaches `.message-user`, `.message-bot`, and `.message-clarify` to visually distinguish intent. Each bubble animates via `@keyframes floatIn`.
- `QuickReplies` – chips rendered as interactive buttons that send templated text back to Moltbot (`intent` chips get an accent border). Chips live just above the textarea so quick follow-ups never require typing.
- Input area – a single `<textarea>` + gradient “Send” button that feels like a messenger composer. The placeholder text reminds users to say “post” when ready.

## Context panels
- `Status` panel – surfaces the current Moltbot status (draft/posting/posted) and the draft ID so testers can confirm ids without leaving the chat.
- `match-card` – each card shows an explainable score (rounded to tenth) and a list of `reasons` (category, price, proximity, recency). The card header includes a short match-type label (internal/vendor/external).
- `ExternalFeedList` – grid of link cards with subtle hover states, each showing the discovery source, confidence (if available), title, and snippet. Links open in a new tab and never promise inventory.
- `NotificationsList` – queue that displays channel, target, status, and Moltbot payload message, giving users visibility into the top-10 notification plan.

## Supporting logic
- `App.tsx` orchestrates messaging + Supabase calls: session bootstrapping (`web_sessions`), draft updates (`market_posts`), `post_now` transitions, and context refreshes (`match_suggestions`, `external_feed_items`, `web_notifications`). The component also gates the experience via `VITE_FEATURE_WEB_MARKETPLACE_CHAT`.
- `supabase` service – centralizes the Supabase client (shared with future components). The client persists sessions so anonymous IDs survive refreshes.
- Helper functions – Moltbot-style heuristics parse messages for intent (type, price, location, category), and clarify missing fields before posting.

Each component is intentionally lightweight so future Moltbot tool plans can hook into them without requiring large rewrites. The CSS uses meaningful variables, responsive grids, and purposeful fonts to keep the UI bold and differentiated rather than default or “purple on white.”
