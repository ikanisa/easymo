# Vendor Onboarding Guide

> **Version:** 1.0  
> **Last Updated:** 2026-01-28

---

## Introduction Message

Use this message when onboarding a new vendor to the Moltbot marketplace:

```
👋 Hello [Business Name]!

We're Moltbot — a marketplace connector that helps buyers find products.

📩 **What to expect:**
You'll receive messages when a buyer needs something you might have in stock.

📝 **How to reply:**
Use this numbered format:
1. Stock: yes or no
2. Price: min–max RWF (e.g., 5000–7000)
3. Location: nearest landmark
4. Options: colors/models if applicable

✅ **What happens next:**
If you confirm stock, we share your info with the buyer for direct contact.

🛑 **Opt out:**
Reply "STOP" anytime to stop receiving messages.
```

---

## Quick Reply Format

When vendors receive an inquiry, they should reply with:

| # | Field | Example |
|---|-------|---------|
| 1 | Stock | yes / no |
| 2 | Price | 5000–7000 RWF |
| 3 | Location | Near Kigali Heights |
| 4 | Options | Black, White, Red |

**Valid reply examples:**
```
1. yes
2. 5000-7000
3. Kimironko Market
4. Black, Silver
```

```
1. no
```

---

## FAQs for Vendors

### Q: Who sends these messages?
**A:** Moltbot, a marketplace connector. We're helping buyers find products in your area.

### Q: How did you get my number?
**A:** You were added to our vendor directory. If you prefer not to receive messages, reply "STOP".

### Q: Do I have to reply?
**A:** No obligation. But replying helps buyers find you!

### Q: What if I'm busy?
**A:** Reply "BUSY" and we'll skip you for the next 2 hours.

### Q: How do I opt back in?
**A:** Reply "START" to resume receiving inquiries.

### Q: Is there a fee?
**A:** No. This service is free for vendors during pilot.

---

## Vendor Preferences

Vendors can set the following preferences (admin-managed or via future self-service):

| Preference | Description | Default |
|------------|-------------|---------|
| `is_opted_out` | Stop all messages | `false` |
| `preferred_language` | EN, FR, or RW | `en` |
| `preferred_categories` | Only receive category-matched inquiries | `[]` (all) |

---

## Onboarding Checklist

- [ ] Vendor added to database with correct phone number
- [ ] Intro message sent successfully
- [ ] Vendor understands quick reply format
- [ ] Opt-out mechanism explained
