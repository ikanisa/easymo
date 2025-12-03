# COMPLETE Supabase Functions Analysis - Deletion Candidates

**Total Functions:** 95  
**Date:** December 3, 2025

---

## ALL 95 SUPABASE FUNCTIONS - CATEGORIZED

### 🔴 PROTECTED - NEVER DELETE (3)

Critical production services - NOT part of consolidation:

1. `wa-webhook-mobility` - Mobility/rides production service
2. `wa-webhook-profile` - Profile management production service  
3. `wa-webhook-insurance` - Insurance production service

---

### ✅ NEWLY CONSOLIDATED (1)

This is the new unified function:

4. `wa-webhook-unified` - NEW consolidated function (contains agents + domains)

---

### 🗑️ TO BE DELETED - After Traffic Migration (4)

Delete after 100% traffic on wa-webhook-unified + 30 days stable:

5. `wa-webhook-ai-agents` - OLD AI agents (replaced by wa-webhook-unified)
6. `wa-webhook-jobs` - Jobs domain (now in wa-webhook-unified/domains/jobs)
7. `wa-webhook-marketplace` - Marketplace (now in wa-webhook-unified/domains/marketplace)
8. `wa-webhook-property` - Property (now in wa-webhook-unified/domains/property)

---

### ⚠️ NEED REVIEW - Potential Duplicates/Legacy (20)

These may be redundant or legacy - need business review:

**Agent Functions (may be duplicates):**
9. `agent-chat` - May be duplicate of wa-webhook-unified agents
10. `agent-config-invalidator` - May be obsolete
11. `agent-monitor` - Check if still needed
12. `agent-negotiation` - May be legacy
13. `agent-property-rental` - May be duplicate of property-agent
14. `agent-quincaillerie` - Check if active
15. `agent-runner` - May be duplicate orchestrator
16. `agent-schedule-trip` - May be duplicate of mobility
17. `agent-shops` - May be duplicate of marketplace
18. `agent-tools-general-broker` - Check if still used
19. `agents` - May be duplicate/legacy
20. `job-board-ai-agent` - May be duplicate of jobs-agent
21. `waiter-ai-agent` - May be duplicate of waiter-agent

**Webhook Functions (check for duplicates):**
22. `wa-webhook` - Generic webhook, may be legacy
23. `wa-webhook-core` - May be duplicate of wa-webhook-unified core

**Other Legacy Candidates:**
24. `ai-contact-queue` - Check if still used
25. `ai-lookup-customer` - May be integrated elsewhere
26. `qr_info` - Underscore naming (legacy?)
27. `schedule_pickup` - Underscore naming (legacy?)

---

### ✅ KEEP - Active Services (68)

**Admin Functions (10):**
28. `admin-health`
29. `admin-messages`
30. `admin-settings`
31. `admin-stats`
32. `admin-trips`
33. `admin-users`
34. `admin-wallet-api`
35. `insurance-admin-api`
36. `send-insurance-admin-notifications`

**Business & Listings (8):**
37. `bars-lookup`
38. `business-lookup`
39. `classify-business-tags`
40. `ingest-businesses`
41. `intelligent-tag-allocation`
42. `listings-sync`
43. `job-sources-sync`
44. `source-url-scraper`

**Crawlers & Sync (2):**
45. `job-crawler`
46. `search-indexer`

**Data & Retention (3):**
47. `data-retention`
48. `housekeeping`
49. `session-cleanup`

**Geocoding & Location (1):**
50. `geocode-locations`

**Media & OCR (4):**
51. `media-fetch`
52. `ocr-processor`
53. `insurance-ocr`
54. `vehicle-ocr`

**Mobile Money & Payments (6):**
55. `momo-allocator`
56. `momo-charge`
57. `momo-sms-hook`
58. `momo-sms-webhook`
59. `momo-webhook`
60. `revolut-charge`
61. `revolut-webhook`

**Notifications & Scheduling (9):**
62. `campaign-dispatcher`
63. `notification-worker`
64. `notify-buyers`
65. `reminder-service`
66. `schedule-broadcast`
67. `schedule-email`
68. `schedule-sms`
69. `search-alert-notifier`
70. `recurring-trips-scheduler`

**OpenAI & AI (3):**
71. `openai-deep-research`
72. `openai-realtime-sip`
73. `generate`

**QR & Deeplinks (2):**
74. `deeplink-resolver`
75. `qr-resolve`

**Search & Retrieval (1):**
76. `retrieval-search`

**Tools (4):**
77. `tool-contact-owner-whatsapp`
78. `tool-notify-user`
79. `tool-shortlist-rank`
80. `edits`

**Trips & Availability (2):**
81. `activate-recurring-trips`
82. `availability-refresh`

**Cleanup & Processing (4):**
83. `cleanup-expired-intents`
84. `cleanup-mobility-intents`
85. `dlq-processor`
86. `wa-events-bq-drain`

**Other Active (6):**
87. `conversations`
88. `insurance-renewal-reminder`
89. `video-performance-summary`

---

## DELETION RECOMMENDATIONS

### Immediate Action: Delete These 4 (After Traffic Migration)
```bash
# Week 7+ (after 100% migration + 30 days stable)
supabase functions delete wa-webhook-ai-agents
supabase functions delete wa-webhook-jobs
supabase functions delete wa-webhook-marketplace
supabase functions delete wa-webhook-property
```

### Review Needed: Check These 20
Need business/technical review to determine if active:
- `agent-*` functions (10 functions)
- `wa-webhook` and `wa-webhook-core` 
- Legacy named functions with underscores
- AI helper functions

**Potential savings:** 20+ more functions could be deleted after review

---

## SUMMARY

| Category | Count | Action |
|----------|-------|--------|
| Protected (mobility, profile, insurance) | 3 | KEEP |
| New unified function | 1 | KEEP |
| To delete after migration | 4 | DELETE (Week 7+) |
| Need review (potential duplicates) | 20 | REVIEW NEEDED |
| Active services to keep | 67 | KEEP |
| **Total** | **95** | |

**Confirmed deletions:** 4 functions  
**Potential additional deletions:** 20+ functions (after review)  
**After all deletions:** ~71 functions (or fewer if review finds more duplicates)

