# Rule 41 — Client Update Policy

Defines when and how to message clients during vendor outreach.

---

## Message Cadence Rules

| Trigger | Message | Max Frequency |
|---------|---------|---------------|
| Outreach started | "Checking with nearby vendors for you…" | Once per request |
| No replies after 4 min | "Still waiting on vendor responses…" | Once per request |
| `min_replies` reached OR timeout | Shortlist OR apology | Once (final) |

---

## Template Messages (WhatsApp-friendly)

### Outreach Started
```
🔍 Checking with nearby vendors for [category]… I'll get back to you shortly!
```

### Still Waiting
```
⏳ Still waiting on vendor responses. Hang tight a bit longer!
```

### Timeout — No Matches
```
😔 Sorry, I couldn't find vendors with [item] in stock right now. Try widening your search or check back later.
```

### Shortlist Ready
```
✅ Great news! I found [N] options for you. Here's a quick summary:
[shortlist items]
Tap a vendor to contact them directly.
```

---

## Anti-Spam Rules

- **Never** send more than 3 client updates per request
- **Never** repeat the same message text within 5 minutes
- **Never** send updates if client hasn't engaged in 30+ minutes
