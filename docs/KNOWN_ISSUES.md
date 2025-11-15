# Known Issues - EasyMO v2.0

**Version**: 2.0.0  
**Last Updated**: 2025-11-11  
**Status**: Release Candidate  
**Review Cycle**: Weekly until v2.1

---

## 📋 Overview

This document lists known issues, limitations, and workarounds for EasyMO v2.0. All issues are
tracked, prioritized, and scheduled for future releases.

**Issue Severity Levels**:

- 🔴 **Critical**: Blocks core functionality
- 🟠 **High**: Significant impact, workaround available
- 🟡 **Medium**: Minor inconvenience, affects some users
- 🟢 **Low**: Cosmetic or edge case, minimal impact

---

## 🔴 Critical Issues

**None** - No critical issues in v2.0 🎉

All critical issues identified in testing phases (1-4) have been resolved.

---

## 🟠 High Priority Issues

### 1. Language Support Limited to English

**Issue ID**: `LANG-001`  
**Severity**: 🟠 High  
**Status**: Known limitation, fix scheduled for v2.1  
**Affects**: Non-English speakers (Kinyarwanda, French, Swahili)

**Description**: AI agents currently only support English language input and output. Users who
prefer other languages must navigate using traditional menus, which are multi-lingual.

**Impact**:

- ~40% of users prefer Kinyarwanda
- ~20% prefer French
- AI adoption limited in non-English speaking regions

**Workaround**:

```
User: [Sends Kinyarwanda message]
System: "I currently support English only. Text 'MENU' for traditional navigation with Kinyarwanda support."

[User texts "MENU"]
[System shows menu in Kinyarwanda]
```

**Fix Schedule**:

- v2.1 (Q1 2026): Kinyarwanda support
- v2.2 (Q2 2026): French support
- v2.3 (Q3 2026): Swahili support

**Related**: See `docs/i18n_roadmap.md`

---

### 2. Geographic Coverage Limited to Kigali

**Issue ID**: `GEO-001`  
**Severity**: 🟠 High  
**Status**: Data quality issue, expanding coverage  
**Affects**: Users outside Kigali

**Description**: Vendor data quality is highest in Kigali. Other cities have limited vendor
coverage, resulting in "No vendors found" responses from AI agents.

**Impact**:

- Kigali: 500+ vendors, 95% coverage
- Musanze: 50 vendors, 60% coverage
- Rubavu: 30 vendors, 40% coverage
- Other cities: <10 vendors, <30% coverage

**Workaround**:

```
AI: "😔 No vendors found in your area.

We're still expanding to your region. In the meantime:
• Try traditional 'Browse Vendors' to see what's available
• Check back soon - we're adding vendors daily!
• Contact support for recommendations

[Browse Vendors] [Home]"
```

**Fix Schedule**:

- v2.1 (Q1 2026): Musanze full coverage
- v2.2 (Q2 2026): All major cities
- v2.3 (Q3 2026): National coverage

**Related**: Vendor onboarding campaign in progress

---

### 3. Marketplace Agent Not Active

**Issue ID**: `AGENT-001`  
**Severity**: 🟠 High  
**Status**: Feature incomplete, delayed to v2.1  
**Affects**: Users looking for complex product searches

**Description**: The Marketplace Agent (for shopping across multiple categories) is developed but
not activated in v2.0 due to incomplete testing.

**Impact**:

- Users can search within categories (pharmacy, hardware, etc.)
- Cannot search across categories ("I need paint AND medicine")
- Multi-vendor shopping cart not available

**Workaround**:

```
User: "I need paint and medicine"

System: "I can help with that! Let's search one at a time:

1️⃣ First, let's find pharmacies for medicine
2️⃣ Then, I'll help you find paint at hardware stores

Would you like to start with medicine or paint?"

[Medicine] [Paint]
```

**Fix Schedule**:

- v2.1 (Q1 2026): Marketplace Agent activated
- Includes: Multi-category search, shopping cart, bulk ordering

**Related**: `FEATURE_MARKETPLACE_AGENT` flag exists but set to `false`

---

## 🟡 Medium Priority Issues

### 4. Session Timeout May Feel Short (10 Minutes)

**Issue ID**: `UX-001`  
**Severity**: 🟡 Medium  
**Status**: Design decision, may extend in v2.1  
**Affects**: Users who take long time to decide

**Description**: Agent sessions expire after 10 minutes for security and resource management. Some
users report this feels too short when comparing multiple options.

**Impact**:

- ~8% of sessions expire before user makes selection
- Users need to restart search
- Slightly lower conversion rate

**Workaround**:

```
System: "😔 Sorry, your selection session has expired.

Sessions last 10 minutes for your security. Please start a new search when you're ready! 🔍

[Start New Search] [Home]"
```

**Mitigation in v2.0**:

- Clear expiration warnings in messages
- Session recovery attempts if possible
- User can quickly restart with same query

**Fix Consideration**:

- v2.1: Extend to 15 minutes (testing impact on resources)
- v2.2: Intelligent timeout (longer for complex searches)

**Tracking**: A/B test planned for v2.1

---

### 5. Voice Messages Not Supported by AI

**Issue ID**: `FEAT-001`  
**Severity**: 🟡 Medium  
**Status**: Feature not yet implemented  
**Affects**: Users who prefer voice over text

**Description**: AI agents only process text messages. Voice messages sent by users are not
transcribed or processed by agents.

**Impact**:

- ~15% of users prefer voice messages
- Voice messages fall back to traditional flow
- Reduced AI adoption among voice-first users

**Workaround**:

```
User: [Sends voice message]

System: "🎤 I can't process voice messages yet (coming soon!).

Please:
• Type your message, or
• Use 'MENU' for traditional navigation

Voice support coming in v2.2!"
```

**Fix Schedule**:

- v2.2 (Q2 2026): Voice transcription (Whisper API)
- v2.3 (Q3 2026): Voice responses (text-to-speech)

---

### 6. Vendor Data Quality Inconsistent

**Issue ID**: `DATA-001`  
**Severity**: 🟡 Medium  
**Status**: Ongoing data cleanup  
**Affects**: Search relevance, especially outside Kigali

**Description**: Some vendor profiles have:

- Incomplete product catalogs
- Outdated prices
- Incorrect locations
- Missing business hours

**Impact**:

- Search results may show vendors that are closed/unavailable
- Prices may not match actual prices
- Delivery estimates may be inaccurate

**Mitigation in v2.0**:

```
# Each vendor result includes:
"💡 Tip: Confirm availability before ordering
     (some prices may have changed)"
```

**Fix Schedule**:

- Ongoing: Vendor data cleanup campaign
- v2.1: Automated data validation
- v2.2: Vendor self-service portal for updates

**Workaround**:

- AI agent asks users to confirm vendor details
- Support team manually verifies problematic vendors
- Users can report incorrect information

---

### 7. Payment Card Support Not Yet Available

**Issue ID**: `PAY-001`  
**Severity**: 🟡 Medium  
**Status**: Feature planned for v2.1  
**Affects**: Users who prefer card payments

**Description**: Only wallet and Mobile Money (MoMo) payments supported. Visa/Mastercard integration
not yet complete.

**Impact**:

- ~10% of users request card payments
- International users may struggle with local payment methods
- Reduced conversion for high-value orders

**Workaround**:

```
System: "Payment Options:
💰 Wallet (5,000 RWF balance)
📱 Mobile Money (MTN/Airtel)

💳 Card payments coming soon!

[Pay with Wallet] [Mobile Money]"
```

**Fix Schedule**:

- v2.1 (Q1 2026): Card payment integration (Stripe/Flutterwave)
- Includes: Visa, Mastercard, Amex

---

## 🟢 Low Priority Issues

### 8. Agent Response Time Occasionally Exceeds 1s

**Issue ID**: `PERF-001`  
**Severity**: 🟢 Low  
**Status**: Performance optimization ongoing  
**Affects**: <5% of requests during peak load

**Description**: Target p95 response time is <1s. During peak load (8-9am, 6-7pm), some requests
take 1-2s.

**Impact**:

- Users experience slight delay
- Still within acceptable UX range
- No functional impact

**Mitigation in v2.0**:

- Loading indicators ("🚖 Searching for drivers...")
- Optimistic UI updates
- Cached responses for common queries

**Fix Schedule**:

- v2.1: Database query optimization
- v2.1: Redis caching expansion
- v2.2: CDN integration for static content

**Metrics**:

- Current p95: ~800ms ✅ (within target)
- Peak p95: ~1200ms ⚠️ (slightly over)
- Target p95: <1000ms

---

### 9. Emoji Rendering Inconsistent on Old Devices

**Issue ID**: `UI-001`  
**Severity**: 🟢 Low  
**Status**: Platform limitation  
**Affects**: Users on Android <8.0 or iOS <12.0

**Description**: Some emojis (🛵, 🎯, 💡) may render as boxes or question marks on older devices.

**Impact**:

- Visual inconsistency
- No functional impact (text still clear)
- Affects <3% of users

**Workaround**:

- All critical information also in text
- Emojis are supplementary, not required
- Example: "🚖 Taxi" → still shows "Taxi" even if emoji fails

**Fix Consideration**:

- v2.2: Detect device capabilities, fall back to text-only when needed
- Not a priority (affects minimal users)

---

### 10. Admin Dashboard Mobile Layout Suboptimal

**Issue ID**: `UI-002`  
**Severity**: 🟢 Low  
**Status**: UI improvement planned for v2.1  
**Affects**: Admins viewing dashboard on mobile

**Description**: Admin dashboard (`/agents/dashboard`) is optimized for desktop. Mobile layout has:

- Small text in charts
- Horizontal scrolling required
- Touch targets too small

**Impact**:

- Admins prefer desktop for monitoring
- Mobile access still functional but not ideal
- ~20% of admin views on mobile

**Workaround**:

- Use landscape mode on mobile
- Desktop browser recommended for monitoring
- WhatsApp admin commands work well on mobile

**Fix Schedule**:

- v2.1: Responsive dashboard redesign
- Mobile-first charts
- Touch-friendly controls

---

## 🐛 Edge Cases & Minor Bugs

### 11. Concurrent Sessions from Same User

**Issue ID**: `EDGE-001`  
**Severity**: 🟢 Low  
**Status**: Rare edge case, fix in v2.1  
**Affects**: Users with multiple WhatsApp devices

**Description**: If user sends messages from multiple devices simultaneously, session state may
become confused.

**Occurrence**: <0.1% of sessions

**Workaround**:

- System detects conflict
- Prompts user: "I see you're active on another device. Continue here?"
- User selects device to continue

**Fix Schedule**: v2.1 (multi-device session sync)

---

### 12. Special Characters in Product Names

**Issue ID**: `EDGE-002`  
**Severity**: 🟢 Low  
**Status**: Fix in progress  
**Affects**: Products with special characters (é, ñ, etc.)

**Description**: Product names with special characters may cause search mismatches.

**Example**:

```
User: "café"
AI searches: "cafe" (without accent)
May miss products listed as "café"
```

**Occurrence**: ~2% of searches

**Mitigation**: Fuzzy matching partially handles this

**Fix Schedule**: v2.1 (improved Unicode handling)

---

### 13. WhatsApp "Typing..." Indicator Not Always Shown

**Issue ID**: `UX-002`  
**Severity**: 🟢 Low  
**Status**: WhatsApp API limitation  
**Affects**: User perception of responsiveness

**Description**: WhatsApp API doesn't reliably show "typing..." indicator when agent is processing.

**Impact**:

- Users may think system is frozen
- Actually processing normally

**Mitigation**:

- Send quick acknowledgment: "🔍 Searching..."
- Then send results
- User knows system is working

**Fix**: Not possible (WhatsApp API limitation)

---

## 🔄 Limitations by Design

These are intentional design decisions, not bugs:

### 14. Max 5 Retries on Failed Requests

**Reason**: Prevent infinite loops, preserve resources  
**Impact**: After 5 retries, user gets fallback flow  
**Occurrence**: <0.5% of requests  
**Alternative**: User can try again manually

### 15. 30-Second Timeout on AI Requests

**Reason**: Ensure responsive UX, prevent hung sessions  
**Impact**: Very slow AI responses get timeout + fallback  
**Occurrence**: <1% of requests (usually OpenAI API issues)  
**Alternative**: Retry automatically, or user retries

### 16. Rate Limit: 60 Requests/Minute per User

**Reason**: Prevent abuse, ensure fair usage  
**Impact**: Power users may hit limit during burst activity  
**Occurrence**: <0.1% of users  
**Alternative**: Temporary cooldown, then resume

### 17. Session Storage Retention: 7 Days

**Reason**: Privacy, GDPR compliance, resource management  
**Impact**: Session history older than 7 days is purged  
**Occurrence**: Normal operation  
**Alternative**: User can restart session anytime

---

## 📊 Issue Statistics

### By Severity

| Severity    | Count  | Percentage |
| ----------- | ------ | ---------- |
| 🔴 Critical | 0      | 0%         |
| 🟠 High     | 3      | 18%        |
| 🟡 Medium   | 4      | 24%        |
| 🟢 Low      | 6      | 35%        |
| By Design   | 4      | 24%        |
| **Total**   | **17** | **100%**   |

### By Category

| Category      | Count |
| ------------- | ----- |
| Language/i18n | 1     |
| Geographic    | 1     |
| Features      | 3     |
| Data Quality  | 1     |
| Performance   | 1     |
| UI/UX         | 3     |
| Edge Cases    | 3     |
| By Design     | 4     |

### Resolution Timeline

| Release        | Issues Fixed           |
| -------------- | ---------------------- |
| v2.0           | All critical issues ✅ |
| v2.1 (Q1 2026) | 7 issues               |
| v2.2 (Q2 2026) | 5 issues               |
| v2.3 (Q3 2026) | 2 issues               |
| By Design      | 4 (not fixing)         |

---

## 🔍 Reporting New Issues

### For End Users

**WhatsApp**: Send "ISSUE [description]" to support number  
**Email**: support@easymo.com  
**Phone**: +250-xxx-xxx-xxx

**Include**:

- Your phone number
- What you were trying to do
- What happened vs. what you expected
- Screenshot if possible

### For Developers

**GitHub Issues**: https://github.com/easymo/platform/issues  
**Slack**: `#engineering-bugs`

**Template**:

```markdown
**Issue ID**: [Auto-assigned] **Severity**: [Critical/High/Medium/Low] **Component**:
[Agent/UI/Backend/Database]

**Description**: [Clear description of issue]

**Steps to Reproduce**:

1. Step 1
2. Step 2
3. ...

**Expected Behavior**: [What should happen]

**Actual Behavior**: [What actually happens]

**Environment**:

- Version: v2.0.0
- Environment: [Production/Staging/Local]
- Browser/Device: [If applicable]

**Logs**: [Paste relevant logs with correlation ID]

**Screenshots**: [Attach if applicable]
```

---

## 📈 Issue Tracking Dashboard

**Live Dashboard**: https://easymo.com/admin/issues  
**Metrics Tracked**:

- Open issues by severity
- Time to resolution
- Issue recurrence rate
- User impact

**SLA Targets**:

- 🔴 Critical: 4 hours
- 🟠 High: 24 hours
- 🟡 Medium: 7 days
- 🟢 Low: 30 days

---

## ✅ Recently Fixed Issues

### In v2.0 (Fixed from Beta)

1. **Session not expiring properly** (SESS-001) - ✅ Fixed
2. **Vendor ranking inconsistent** (RANK-001) - ✅ Fixed
3. **Fallback loops on network errors** (FALL-001) - ✅ Fixed
4. **Admin dashboard charts not loading** (UI-003) - ✅ Fixed
5. **Payment webhook failures** (PAY-002) - ✅ Fixed
6. **Agent responses in wrong language** (LANG-002) - ✅ Fixed (English only by design)

---

## 🤝 Contributing to Issue Resolution

**Want to help fix issues?**

1. Check `docs/CONTRIBUTING.md` for guidelines
2. Pick an issue from the dashboard
3. Comment on GitHub issue to claim it
4. Submit PR with fix
5. Add test coverage

**Bounty Program**: Some high-priority issues have bounties ($100-$500).  
Contact: eng-lead@easymo.com

---

## 📚 Related Documentation

- **Release Notes**: `RELEASE_NOTES_v2.0.md`
- **Migration Guide**: `docs/MIGRATION_GUIDE_v2.md`
- **Troubleshooting**: `docs/TROUBLESHOOTING.md`
- **Support Runbook**: `docs/SUPPORT_RUNBOOK.md`
- **Engineering Runbook**: `docs/ENGINEERING_RUNBOOK.md`

---

**Document Version**: 1.0  
**Last Updated**: 2025-11-11  
**Status**: Active  
**Next Review**: 2025-11-18 (weekly)

---

_Found a new issue? Report it: support@easymo.com_
