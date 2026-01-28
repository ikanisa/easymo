---
description: "Add multilingual UX for WhatsApp (EN/FR/RW): consistent templates, language detection, and Moltbot/Gemini instructions to keep outputs concise and culturally natural."
---

# Workflow 17 — Multilingual UX (EN/FR/RW)

## Goal
Make the concierge usable in Rwanda and beyond:
- Detect user language (or let them choose)
- Keep all client-facing messages consistent
- Moltbot outputs follow chosen language
- Vendor outreach in vendor's preferred language

## Outputs
1) Language detection + persistence
2) Template library (EN/FR/RW)
3) Moltbot context pack with language
4) OCR clarification prompts localized
5) Tests for language handling

## Step 1 — Language selection rules
Create `.agent/rules/95_language_policy.md`:

Priority order:
1. If `conversations.language` set → use it
2. Else infer from first 1–3 messages:
   - Kinyarwanda markers → `rw`
   - French markers → `fr`
   - Default → `en`
3. Allow explicit override: "English", "Français", "Kinyarwanda"

Vendor language:
- Add optional `vendors.language`
- Outreach uses vendor language if set

## Step 2 — Build template library
Create:
- `docs/i18n/templates.en.md`
- `docs/i18n/templates.fr.md`
- `docs/i18n/templates.rw.md`

Templates:
1. `processing_image`
2. `clarify_questions`
3. `checking_vendors`
4. `still_waiting`
5. `shortlist_intro`
6. `shortlist_item_line`
7. `handoff_footer`
8. `apology_no_results`
9. `consent_request_call`
10. `consent_confirm_yes/no`

Keep messages short (WhatsApp-friendly).

## Step 3 — Context pack updates
Update context pack to include:
- `language` (en|fr|rw)
- `style_constraints`: max_questions_per_turn=3, concise=true

## Step 4 — Moltbot skill multilingual
Update `skills/marketplace-concierge/prompt.md`:

- Always respond in `context.language`
- If uncertain, use simple words
- Never switch language mid-request unless asked

## Step 5 — Vendor outreach
Use vendor language if known.
Keep question numbering consistent across languages.

## Step 6 — Tests
1. First message in French → language=fr
2. Explicit "Kinyarwanda" overrides
3. Shortlist uses correct template set
4. No mixed-language output

## Done when
- Same flow works in EN/FR/RW with consistent UX
