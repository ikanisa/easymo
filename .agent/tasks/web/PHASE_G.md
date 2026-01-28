---
description: "PHASE G — Web External Feeds (links only)."
---

# PHASE G — External Feeds

## G1 — External discovery tools integrated to web posts
Implement:
- external discovery tools integrated to web posts
- store to external_feed_items
- display as links only

Tools:
- discovery.web_search_items (OpenAI web search OR Gemini grounding)
- discovery.maps_places_items
- discovery.social_profile_items

Constraints:
- budgets per post (max 2 calls per source)
- no inventory claims
- external items displayed as links only

**Acceptance**:
- flags OFF: no external calls
- flags ON: links appear; budgets enforced; external_feed_items created

**Rollback**:
- WEB_DISCOVERY_ENABLED=false
