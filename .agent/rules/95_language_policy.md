# Rule 95 — Language Policy

## Scope
Governs language detection, persistence, and switching for WhatsApp concierge.

---

## Language Detection Priority

1. **Explicit DB value**: If `conversations.language` is set, use it
2. **Detect from messages**: Infer from first 1–3 inbound messages
3. **Default**: `en` (English)

---

## Detection Markers

### Kinyarwanda (`rw`)
- "murakoze", "muraho", "amakuru", "ndashaka", "mwiriwe", "yego", "oya", "ijoro ryiza"
- Greeting patterns with "mura-" prefix

### French (`fr`)  
- "bonjour", "bonsoir", "merci", "je voudrais", "s'il vous plaît", "comment", "oui", "non"
- Common greeting patterns with accents

### English (`en`)
- "hello", "hi", "thanks", "please", "I want", "I need", "yes", "no"
- Default if no markers match

---

## Explicit Override

User can switch language anytime by sending:
- "English" or "EN" → `en`
- "Français" or "French" or "FR" → `fr`
- "Kinyarwanda" or "Ikinyarwanda" or "RW" → `rw`

Override updates `conversations.language` and takes effect immediately.

---

## Vendor Language

- Add optional `vendors.language` column
- When contacting vendors, use vendor's language if set
- Keep question numbering consistent across languages (1., 2., 3.)

---

## Moltbot Output Rules

1. Always output client messages in `context.language`
2. If uncertain about phrasing, use simple universal words
3. Never switch language mid-request unless explicitly asked
4. Keep all messages concise (WhatsApp-friendly)

---

## Fallback Behavior

If language detection fails or is ambiguous:
- Use bilingual fallback: English + French
- Example: "Thank you / Merci"
