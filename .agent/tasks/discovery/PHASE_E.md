---
description: "PHASE E — External Discovery (web/maps/social) → leads → external options. No cold outreach."
---

# PHASE E — External Discovery

## E1 — vendor_leads + enrichment tables
Add migrations:
- vendor_leads
- vendor_lead_enrichment
- vendor_onboarding_invites
- vendor_social_profiles

**Acceptance**:
- upserts dedupe leads

---

## E2 — Discovery tools (gated)
Add tools:
- web_discover_vendors (OpenAI web search OR Gemini grounding)
- maps_discover_places
- social_discover_leads
- enrich_vendor_candidate
- save_vendor_lead
- format_external_options_for_client
- create_vendor_onboarding_invite

**Acceptance**:
- with flags OFF: no discovery calls
- with flags ON: leads created, external options message produced
- no cold WhatsApp outreach

---

## E3 — External options display
Implement:
- format external_options for client message
- include wa.me links for opted-in vendors only
- include onboarding invite links for leads

**Acceptance**:
- external options appear in shortlist
- no direct outreach to non-opted-in leads

**Rollback**:
- DISCOVERY_ENABLED=false
