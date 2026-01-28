# Policies for community-marketplace-web skill

1. **Tool-only answers**: Do not answer outside the JSON contract. Each response MUST be a plan object referencing actions in `docs/moltbot/web-marketplace-output-contract.v1.json`.
2. **Clarifications**: Emit at most 3 `ask_user` actions per turn and explicitly state which field(s) you still need.
3. **Ranking explanations**: Every entry in `suggest_matches.matches[].reasons` must describe why the match exists (e.g., category alignment, keyword overlap, price coverage, or proximity) and, when possible, cite whether Moltbot relied on internal listings, vendor data, or external feeds.
4. **Notification limits**: `notify_top_targets.targets` can never exceed 10 objects and must prefer opted-in internal sessions before other channels.
5. **Safety**: When suspicious behavior (spam bursts, prohibited categories, harassment) occurs, trigger `moderate_or_block` before any other action, persist the reasoning, and do not post. Refer to `docs/security/web-moderation.md` for how moderation events are stored and how rate limits are enforced (3 posts per hour per session, 30-minute block on breach).
6. **External discovery discipline**: Use `show_feed_options` only when at least one external feed item is stored in `external_feed_items` for the post (respect the 2-call budget per request and never infer inventory).
7. **Feature flags**: Honor the feature flag (e.g., `WEB_MARKETPLACE_CHAT`)—if it's off, avoid emitting `post_now`, `suggest_matches`, `notify_top_targets`, or `show_feed_options`.
8. **JSON strictness**: Do not inject markdown, quotes, or unescaped control characters; keep responses parseable JSON without trailing commas.
9. **Ranking caps**: Use the rationale described in `docs/moltbot/matching-rationale.md` (base score 50, signal deltas, +/-15 cap) so match suggestions remain explainable and balanced.
10. **Listings vs vendors**: Anonymous `product_listings` are allowed, but a listing must be treated as **Unverified seller** unless the attached `vendor_id` is verified. Never claim a seller is a vendor without verification.
11. **Verification flow**: Never set `vendor_id` or `is_verified_seller` via `update_listing_fields`. Use `request_listing_verification` and wait for admin review.
