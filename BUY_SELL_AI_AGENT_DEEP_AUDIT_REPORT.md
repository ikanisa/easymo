# Buy & Sell AI Agent - Deep Audit Report

**Date:** December 18, 2025  
**Scope:** Complete audit of Buy & Sell AI agent implementation  
**Requirement:** Agent must have conversations with users, get intent, find nearby 30 businesses, ask user permission, send broadcast messages, and inform user of outcomes.

---

## Executive Summary

This audit identifies **critical gaps** and **implementation issues** in the Buy & Sell AI agent that prevent it from fully meeting the requirements. While the core infrastructure exists, several key components are missing or incomplete:

1. **Missing 30-business limit implementation** - Current code limits results to 3-5 or 10-20 businesses
2. **Incomplete user consent flow** - No clear integration between candidate saving and consent request
3. **Missing vendor response notification to users** - Vendor responses are tracked but users are not notified
4. **Database schema gaps** - Missing `google_maps_uri` column in `candidate_vendors` table
5. **Disconnected agent flows** - `notify-buyers` (EnhancedMarketplaceAgent) and `agent-worker` have separate, non-integrated flows

---

## 1. Conversation Flow & Intent Extraction

### ✅ **STRENGTHS**

1. **Intent Extraction Implementation**
   - Location: `supabase/functions/notify-buyers/core/agent-enhanced.ts` (lines 355-417)
   - Uses Gemini Flash model for fast intent extraction
   - Structured JSON schema output with confidence scoring
   - Handles: `buying`, `selling`, `inquiry`, `unclear` intents

2. **Gemini Integration**
   - Location: `supabase/functions/_shared/gemini.ts`
   - Proper retry logic implemented
   - Voice note transcription support
   - System instructions for Kwizera persona defined

3. **Conversation State Management**
   - Table: `marketplace_conversations`
   - Tracks: `flow_type`, `flow_step`, `collected_data`, `conversation_history`
   - Location-aware context (lat/lng stored)

### ❌ **GAPS & ISSUES**

1. **No Explicit Conversation Flow After Intent**
   - After intent extraction, the agent jumps directly to deep reasoning without explicit confirmation
   - Missing step: "I understand you're looking for [product]. Is that correct?"

2. **Intent Confidence Handling**
   - Low confidence intents (< 0.6) go to simple response, but don't ask clarifying questions
   - Should ask: "I'm not sure I understood. Could you clarify what you're looking for?"

3. **Location Requirement Not Enforced**
   - System instruction says location is required, but agent continues without it
   - Should block progression until location is shared

---

## 2. Business Search & 30 Business Requirement

### ✅ **STRENGTHS**

1. **PostGIS Proximity Search**
   - Location: `supabase/functions/_shared/memory/vendor-proximity.ts`
   - Fast sub-second queries using PostGIS geography
   - Prioritizes Tier 1 (onboarded) vendors over Tier 2

2. **Google Maps & Search Grounding**
   - Location: `supabase/functions/_shared/buy-sell-tools.ts`
   - Gemini has access to `googleMaps` and `googleSearch` tools
   - Proper tool configuration in `SOURCING_TOOLS_CONFIG`

### ❌ **CRITICAL GAPS**

1. **30 Business Limit NOT Implemented**
   - **Current Implementation:**
     - `agent-enhanced.ts` line 445: `limit: 10` for Tier 1 vendors
     - `vendor-proximity.ts` line 44: `limit = 20` default
     - `save_candidates` tool description (line 102): "top 3-5 vendor matches"
   
   - **Requirement:** Find up to 30 nearby businesses
   
   - **Issue:** System instruction says "3-5 matches" but requirement is 30

2. **No Aggregation Logic for 30 Businesses**
   - Agent saves candidates but doesn't attempt to find 30 total
   - Should combine:
     - Tier 1 vendors (onboarded, up to 10)
     - Google Maps results (up to 15)
     - Google Search results (up to 5)
     - Total: 30 businesses

3. **Candidate Display Limitation**
   - `agent-worker/index.ts` line 266: Only shows first 3 candidates to user
   - User never sees the full list of 30 businesses

4. **Missing Business List Display Format**
   - No WhatsApp list message formatting for 30 businesses
   - Should use WhatsApp interactive list with pagination

---

## 3. User Consent Flow Before Broadcast

### ✅ **STRENGTHS**

1. **Consent Mechanism Exists**
   - Location: `supabase/functions/agent-worker/index.ts` (lines 262-270)
   - Asks: "Would you like me to contact them on your behalf? Reply YES to proceed."
   - Stores state in `conversations` table with `CONFIRM_OUTREACH` step

### ❌ **CRITICAL GAPS**

1. **Not Integrated with EnhancedMarketplaceAgent**
   - `agent-enhanced.ts` saves candidates but doesn't ask for consent
   - `agent-worker` has consent flow but is a separate function
   - **Two disconnected flows:**
     - `notify-buyers` → `EnhancedMarketplaceAgent` → saves candidates → **STOPS**
     - `agent-worker` → extracts intent → finds candidates → asks consent → broadcasts
   
2. **No Consent State in EnhancedMarketplaceAgent**
   - `MarketplaceContext` has `pendingVendorOutreach` but it's never set
   - After `save_candidates`, agent should:
     - Set `pendingVendorOutreach.awaitingConsent = true`
     - Update conversation state
     - Ask user for permission

3. **Consent Request Message Incomplete**
   - Should show:
     - Total count of businesses (e.g., "I found 30 businesses")
     - Preview of top 5-10 businesses
     - Clear call-to-action with YES/NO buttons

4. **No Explicit Permission Tracking**
   - Should store consent in `marketplace_inquiries` or separate table
   - Need audit trail: when consent was given, by whom, for which businesses

---

## 4. Broadcast Message Sending

### ✅ **STRENGTHS**

1. **WhatsApp Broadcast Function**
   - Location: `supabase/functions/whatsapp-broadcast/index.ts`
   - Uses WhatsApp Cloud Business API (not Twilio) ✅
   - Opt-in/opt-out compliance checking
   - Regional filtering (blocks UG, KE, NG, ZA)
   - Database logging to `whatsapp_broadcast_requests` and `whatsapp_broadcast_targets`

2. **Broadcast Message Format**
   - Lines 280-282: Clear message template with HAVE_IT/NO_STOCK/STOP options
   - Includes user location and need description

### ❌ **GAPS & ISSUES**

1. **Broadcast Uses `vendors` Table, Not `candidate_vendors`**
   - `whatsapp-broadcast` queries `vendors` table (line 395)
   - But candidates are saved in `candidate_vendors` table
   - **Gap:** No link between saved candidates and broadcast targets
   
2. **No Direct Candidate-to-Broadcast Mapping**
   - Should broadcast to businesses from `candidate_vendors` table
   - Current flow: Agent finds candidates → saves them → broadcast queries different table

3. **Broadcast Doesn't Use Saved Candidates**
   - `agent-worker` calls broadcast with `requestId` (line 367)
   - But broadcast function doesn't use `candidate_vendors.request_id`
   - Should query: `SELECT * FROM candidate_vendors WHERE request_id = ?`

4. **Template Message vs Plain Text**
   - Uses WhatsApp template (line 483) but should verify template exists
   - Fallback to plain text if template not configured

---

## 5. Vendor Response Tracking & User Notification

### ✅ **STRENGTHS**

1. **Vendor Reply Tracking**
   - Location: `supabase/functions/whatsapp-inbound/index.ts` (lines 326-382)
   - Detects vendor replies (HAVE_IT, NO_STOCK, STOP_MESSAGES)
   - Stores in `whatsapp_business_replies` table
   - Links to `broadcast_target_id`

2. **Response Parsing**
   - Function: `parseVendorAction()` (line 335)
   - Handles positive responses and opt-outs

### ❌ **CRITICAL GAPS**

1. **Users Are NOT Notified of Vendor Responses**
   - Line 381: `// TODO: Notify matching buyers`
   - **This is the biggest gap!**
   - Vendor replies are logged but user never receives notification

2. **No Link Between Vendor Reply and Original User Request**
   - `whatsapp_business_replies.broadcast_target_id` links to broadcast
   - But no direct link to original `sourcing_request` or user phone
   - Should track: `user_phone`, `inquiry_id`, `sourcing_request_id`

3. **No Response Aggregation**
   - Should aggregate all responses for a broadcast
   - User should receive summary: "5 businesses responded: 3 have it, 2 don't"

4. **Missing User Notification Function**
   - Should send WhatsApp message to user when vendor responds:
     - "✅ [Business Name] has [product]. Contact: +250..."
     - "❌ [Business Name] doesn't have [product]"

5. **No Response Time Tracking**
   - Should track: when broadcast sent, when vendor responded
   - Useful for analytics and vendor quality scoring

---

## 6. Database Schema Issues

### ✅ **STRENGTHS**

1. **Core Tables Exist**
   - `candidate_vendors` - Stores found businesses
   - `whatsapp_broadcast_requests` - Broadcast campaigns
   - `whatsapp_broadcast_targets` - Individual targets
   - `whatsapp_business_replies` - Vendor responses
   - `marketplace_conversations` - User conversation state

### ❌ **SCHEMA GAPS**

1. **Missing `google_maps_uri` Column in `candidate_vendors`**
   - Tool definition expects `google_maps_uri` (buy-sell-tools.ts line 44)
   - But table doesn't have this column
   - **SQL:** `ALTER TABLE candidate_vendors ADD COLUMN google_maps_uri TEXT;`

2. **No Direct Link Between Broadcast and User**
   - `whatsapp_broadcast_requests` doesn't have `user_phone` or `user_id`
   - Should add: `user_phone TEXT`, `sourcing_request_id UUID`

3. **No Response Notification Tracking**
   - Should add table: `vendor_response_notifications`
   - Fields: `id`, `broadcast_id`, `vendor_reply_id`, `user_phone`, `notified_at`, `message_sent`

4. **Missing Business List Display Cache**
   - When showing 30 businesses to user, should cache the list
   - Add: `candidate_vendors.display_order INTEGER` for ordering

---

## 7. Gemini AI Tools Configuration

### ✅ **STRENGTHS**

1. **Tool Definitions**
   - Location: `supabase/functions/_shared/buy-sell-tools.ts`
   - `save_candidates` tool properly defined
   - Google Search and Maps grounding configured

2. **Tool Execution**
   - Location: `supabase/functions/notify-buyers/core/agent-enhanced.ts` (lines 638-685)
   - Properly handles `save_candidates` tool calls
   - Extracts `final_response_text` from tool result

### ❌ **GAPS**

1. **Tool Doesn't Enforce 30 Business Limit**
   - `save_candidates` description says "3-5 matches"
   - Should say "Save up to 30 vendor candidates"

2. **No Business Aggregation Tool**
   - Should have tool: `aggregate_business_results`
   - Combines Tier 1 + Google Maps + Google Search results
   - Ensures exactly 30 businesses (or fewer if not available)

3. **Missing Final Response Template**
   - Tool's `final_response_text` should include:
     - Count: "I found 30 businesses..."
     - Preview: "Top 5: ..."
     - Consent request: "Should I contact them for you?"

---

## 8. System Instructions & Persona

### ✅ **STRENGTHS**

1. **Kwizera Persona Defined**
   - Location: `agent-enhanced.ts` lines 63-103
   - Clear persona: "world-class AI Sourcing Agent"
   - Africa-only mandate with geo-fencing

2. **System Instructions**
   - Intent extraction instructions (lines 95-98)
   - Response generation instructions (lines 100-103)

### ❌ **GAPS**

1. **System Instruction Doesn't Mention 30 Businesses**
   - Line 102: "call 'save_candidates' with the most viable 3-5 vendor matches"
   - Should say: "call 'save_candidates' with up to 30 vendor matches"

2. **No Instruction for Consent Request**
   - Should add: "After saving candidates, always ask user permission before broadcasting"

3. **Missing Response Notification Instruction**
   - Should add: "When vendors respond, notify the user immediately with business details"

---

## 9. Integration & Flow Completeness

### ❌ **CRITICAL INTEGRATION GAPS**

1. **Two Separate Agent Implementations**
   - `EnhancedMarketplaceAgent` (notify-buyers) - saves candidates, stops
   - `agent-worker` - extracts intent, finds candidates, asks consent, broadcasts
   - **They don't work together!**

2. **Missing Flow Connection**
   ```
   Current (BROKEN):
   User → notify-buyers → EnhancedMarketplaceAgent → save_candidates → STOPS
   User → agent-worker → extract intent → find candidates → ask consent → broadcast
   
   Required:
   User → notify-buyers → EnhancedMarketplaceAgent → find 30 businesses → 
   save_candidates → ask consent → user confirms → broadcast → 
   track responses → notify user
   ```

3. **No State Machine for Consent**
   - `state-machine.ts` is empty (only returns `{ handled: false }`)
   - Should handle `PENDING_CONSENT` state

---

## 10. Recommendations & Required Fixes

### 🔴 **CRITICAL (Must Fix)**

1. **Implement 30 Business Search**
   - Update `getTier1Vendors()` to return up to 10
   - Update Gemini to use Google Maps for 15 more
   - Update Google Search for 5 more
   - Aggregate to exactly 30 (or fewer if unavailable)
   - Update `save_candidates` tool description

2. **Add User Consent Flow to EnhancedMarketplaceAgent**
   - After `save_candidates`, set `pendingVendorOutreach.awaitingConsent = true`
   - Send message: "I found 30 businesses. Should I contact them? Reply YES"
   - Wait for user confirmation before calling broadcast

3. **Implement User Notification for Vendor Responses**
   - Create function: `notifyUserOfVendorResponse()`
   - When vendor replies (HAVE_IT/NO_STOCK), send WhatsApp to user
   - Include business name, phone, and product availability

4. **Fix Database Schema**
   - Add `google_maps_uri` to `candidate_vendors`
   - Add `user_phone` to `whatsapp_broadcast_requests`
   - Create `vendor_response_notifications` table

5. **Link Broadcast to Saved Candidates**
   - Update `whatsapp-broadcast` to query `candidate_vendors` by `request_id`
   - Don't query `vendors` table separately

### 🟡 **HIGH PRIORITY (Should Fix)**

6. **Unify Agent Flows**
   - Merge `agent-worker` consent logic into `EnhancedMarketplaceAgent`
   - Or create shared consent handler

7. **Add Business List Display**
   - Show all 30 businesses in WhatsApp interactive list
   - Use pagination if needed

8. **Update System Instructions**
   - Mention 30 business limit
   - Add consent request instruction
   - Add response notification instruction

9. **Implement State Machine**
   - Add `PENDING_CONSENT` state handling
   - Handle YES/NO responses

### 🟢 **MEDIUM PRIORITY (Nice to Have)**

10. **Add Response Aggregation**
    - Summarize all vendor responses
    - Send single notification: "5 responded: 3 have it, 2 don't"

11. **Add Analytics**
    - Track response times
    - Track consent rates
    - Track vendor response rates

12. **Improve Error Handling**
    - Handle broadcast failures gracefully
    - Retry logic for failed broadcasts

---

## 11. Code Locations Reference

| Component | File Path | Key Functions |
|-----------|-----------|---------------|
| Main Agent | `supabase/functions/notify-buyers/core/agent-enhanced.ts` | `process()`, `executeDeepReasoning()`, `handleToolCalls()` |
| Intent Extraction | `supabase/functions/notify-buyers/core/agent-enhanced.ts` | `extractIntent()` |
| Business Search | `supabase/functions/_shared/memory/vendor-proximity.ts` | `findVendorsNearby()`, `getTier1Vendors()` |
| Tools | `supabase/functions/_shared/buy-sell-tools.ts` | `executeSaveCandidates()` |
| Broadcast | `supabase/functions/whatsapp-broadcast/index.ts` | Main handler |
| Vendor Replies | `supabase/functions/whatsapp-inbound/index.ts` | `parseVendorAction()` |
| Consent Flow | `supabase/functions/agent-worker/index.ts` | `handleConfirmOutreach()` |
| Gemini Integration | `supabase/functions/_shared/gemini.ts` | `generateContent()`, `extractIntent()` |

---

## 12. Test Scenarios

### ✅ **Scenarios That Should Work (But May Not)**

1. User sends: "I need paracetamol near Kigali"
   - ✅ Intent extraction works
   - ✅ Location handling works
   - ❌ Only finds 3-5 businesses (not 30)
   - ❌ Doesn't ask for consent
   - ❌ Doesn't notify user of responses

2. User confirms: "YES"
   - ❌ Consent handler not in EnhancedMarketplaceAgent
   - ✅ Broadcast function works (but uses wrong table)

3. Vendor responds: "HAVE IT"
   - ✅ Response is tracked
   - ❌ User is not notified

---

## Conclusion

The Buy & Sell AI agent has **solid infrastructure** but **critical gaps** prevent it from meeting the full requirements. The main issues are:

1. **30 business limit not implemented** (currently 3-5)
2. **User consent flow missing** in main agent
3. **User notification missing** for vendor responses
4. **Disconnected agent implementations** (notify-buyers vs agent-worker)
5. **Database schema gaps** (missing columns and tables)

**Priority:** Fix critical items (#1-5) before production deployment.

**Estimated Effort:**
- Critical fixes: 2-3 days
- High priority: 1-2 days
- Medium priority: 1 day

**Total:** 4-6 days of development work.

