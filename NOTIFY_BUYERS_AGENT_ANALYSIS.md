# Notify-Buyers Agent: Current Implementation Analysis & Refactoring Plan

## Executive Summary

This document provides a comprehensive analysis of the current `notify-buyers` AI agent implementation, compares it against the Kwizera reference architecture, identifies critical gaps, and outlines a robust refactoring plan to transform it into a world-class sourcing agent.

**Status**: Current implementation is functional but lacks advanced capabilities required for production-grade sourcing operations.

---

## 1. Current Implementation Overview

### 1.1 Architecture

**Current Stack:**
- **AI Provider**: `DualAIProvider` → `LLMRouter` → OpenAI/Gemini (basic routing)
- **Model**: Single model approach (configurable via env, defaults to `gemini-1.5-flash`)
- **Tools**: ❌ **NONE** - No tool integration
- **State Management**: Basic conversation state in `marketplace_conversations` table
- **Voice Support**: ❌ Not implemented in notify-buyers

**Key Files:**
- `supabase/functions/notify-buyers/core/agent.ts` - Main agent class (1,163 lines)
- `supabase/functions/notify-buyers/index.ts` - Webhook handler (763 lines)
- `supabase/functions/_shared/agents/marketplace-ai-provider.ts` - AI provider wrapper

### 1.2 Current Capabilities

✅ **Working:**
- Basic conversational AI (text messages)
- Intent extraction (buying, selling, inquiry)
- Entity extraction (product, price, location, etc.)
- Conversation state persistence
- Welcome/greeting messages
- Location handling (when shared)
- Business search via database RPC (`search_businesses_nearby`)
- Listing creation
- Buyer matching notifications

❌ **Missing:**
- Google Search grounding
- Google Maps grounding
- Vendor candidate saving (`save_candidates` tool)
- Multi-model strategy (reasoning vs intent)
- Voice note transcription
- Geo-fencing and access control
- Vendor tier system (Tier 1, Tier 2)
- Vendor outreach/broadcasting
- Thinking budget configuration
- Structured learning/memory
- Proximity-based vendor ranking
- Price discovery
- Vendor reliability verification

---

## 2. Comparison: Current vs Kwizera Reference

### 2.1 AI Model Strategy

| Aspect | Current | Kwizera Reference | Gap |
|--------|---------|-------------------|-----|
| **Intent Extraction** | Single model (Flash) | Gemini 3 Flash (fast) | ✅ Model choice OK, but no separation |
| **Deep Reasoning** | Same model | Gemini 3 Pro (32k thinking budget) | ❌ **CRITICAL GAP** |
| **Voice Transcription** | Not implemented | Gemini 2.5 Flash Native Audio | ❌ **CRITICAL GAP** |
| **Tool Integration** | None | Google Search + Maps + save_candidates | ❌ **CRITICAL GAP** |

### 2.2 Tools & Grounding

| Tool | Current | Kwizera Reference | Gap |
|------|---------|-------------------|-----|
| **Google Search** | ❌ Not available | ✅ Integrated | ❌ **CRITICAL GAP** |
| **Google Maps** | ❌ Not available | ✅ Integrated | ❌ **CRITICAL GAP** |
| **save_candidates** | ❌ Not available | ✅ Custom tool | ❌ **CRITICAL GAP** |
| **Database Search** | ✅ Basic RPC | ✅ Enhanced with tiers | ⚠️ Needs enhancement |

### 2.3 Sourcing Workflow

| Step | Current | Kwizera Reference | Gap |
|------|---------|-------------------|-----|
| **1. Proximity Search** | Database RPC only | Google Maps (10-20km) | ❌ Missing Maps |
| **2. Reliability Check** | None | Google Search (social media, news) | ❌ Missing verification |
| **3. Price Discovery** | None | Google Search (market rates) | ❌ Missing pricing |
| **4. Vendor Saving** | None | save_candidates tool | ❌ Missing persistence |
| **5. Tier Classification** | None | Tier 1 (internal) vs Tier 2 (public) | ❌ Missing hierarchy |

### 2.4 Geo-Fencing & Access Control

| Feature | Current | Kwizera Reference | Gap |
|---------|---------|-------------------|-----|
| **Africa-Only Mandate** | ❌ Not enforced | ✅ Strict enforcement | ❌ **CRITICAL GAP** |
| **Country Blocking** | ❌ Not implemented | ✅ Blocks UG, KE, NG, ZA | ❌ **CRITICAL GAP** |
| **LPM Phone Resolution** | ❌ Not implemented | ✅ Longest Prefix Match | ❌ Missing |

### 2.5 Voice & Multi-Modal

| Feature | Current | Kwizera Reference | Gap |
|---------|---------|-------------------|-----|
| **Voice Note Support** | ❌ Not in notify-buyers | ✅ Full support | ❌ **CRITICAL GAP** |
| **Audio Transcription** | ❌ Not implemented | ✅ Gemini 2.5 Flash Native Audio | ❌ Missing |
| **Multi-Modal Input** | ❌ Text only | ✅ Text + Audio + Location | ⚠️ Partial (location only) |

### 2.6 Vendor Management

| Feature | Current | Kwizera Reference | Gap |
|---------|---------|-------------------|-----|
| **Tier System** | ❌ Not implemented | ✅ Tier 1 (verified) vs Tier 2 (public) | ❌ Missing |
| **Vendor Outreach** | ❌ Not implemented | ✅ WhatsApp broadcast to vendors | ❌ Missing |
| **Response Handling** | ❌ Not implemented | ✅ "HAVE IT" button → Match Found | ❌ Missing |
| **Rate Limiting** | ❌ Not implemented | ✅ Prevent broadcast spam | ❌ Missing |

### 2.7 Learning & Memory

| Feature | Current | Kwizera Reference | Gap |
|---------|---------|-------------------|-----|
| **Structured Learning** | ❌ Not implemented | ✅ LEARNING_SCHEMA (reputation, pricing, facts) | ❌ Missing |
| **Market Knowledge** | ❌ Not implemented | ✅ Intelligence Hub with tags | ❌ Missing |
| **Vendor Reputation** | ❌ Not tracked | ✅ Tracked (highly_responsive, slow_responder, etc.) | ❌ Missing |

---

## 3. Critical Gaps Analysis

### 3.1 **CRITICAL: No Tool Integration**

**Impact**: Agent cannot search Google Maps, verify vendors, or save candidates.

**Current State:**
```typescript
// agent.ts - No tools passed to AI
const response = await this.aiProvider.chat(messages, {
  temperature: AI_TEMPERATURE,
  maxTokens: AI_MAX_TOKENS,
  metadata: { agent: "buy_sell" },
});
// ❌ No tools parameter
```

**Required:**
```typescript
// Should include:
tools: [
  { googleSearch: {} },
  { googleMaps: { dataProviders: ["PLACES"] } },
  { functionDeclarations: [SAVE_CANDIDATES_DECLARATION] }
]
```

### 3.2 **CRITICAL: No Multi-Model Strategy**

**Impact**: Cannot leverage deep reasoning for complex sourcing decisions.

**Current State:**
- Single model for all tasks
- No thinking budget configuration
- No separation between fast intent extraction and deep reasoning

**Required:**
- **Intent Extraction**: Gemini 3 Flash (fast, low cost)
- **Deep Reasoning**: Gemini 3 Pro (32k thinking budget for complex sourcing)
- **Voice Transcription**: Gemini 2.5 Flash Native Audio

### 3.3 **CRITICAL: No Voice Note Support**

**Impact**: Users cannot send voice notes (common in African markets).

**Current State:**
- `notify-buyers/index.ts` only handles text messages
- No audio message extraction
- No transcription pipeline

**Required:**
- Detect audio messages in webhook
- Download audio from WhatsApp
- Transcribe using Gemini 2.5 Flash Native Audio
- Process transcribed text through agent

### 3.4 **CRITICAL: No Geo-Fencing**

**Impact**: Cannot enforce Africa-only mandate or block specific countries.

**Current State:**
- No location validation
- No country blocking
- No LPM phone resolution

**Required:**
- Extract country from phone number (LPM)
- Validate against allowed countries
- Block UG, KE, NG, ZA (or redirect to cross-border strategy)

### 3.5 **HIGH: No Vendor Tier System**

**Impact**: Cannot prioritize verified partners or separate internal vs public vendors.

**Current State:**
- All vendors treated equally
- No distinction between verified partners and public listings

**Required:**
- **Tier 1**: Internal verified partners (can message directly)
- **Tier 2**: Public listings (user contacts directly)
- Separate presentation in results

### 3.6 **HIGH: No Vendor Outreach**

**Impact**: Cannot automatically message vendors to check stock availability.

**Current State:**
- No vendor broadcasting
- No "HAVE IT" button handling
- No match notification system

**Required:**
- Broadcast to Tier 1 vendors
- Handle vendor responses
- Notify user when match found

### 3.7 **MEDIUM: No Structured Learning**

**Impact**: Cannot learn from interactions to improve future sourcing.

**Current State:**
- No reputation tracking
- No pricing tier learning
- No market intelligence storage

**Required:**
- LEARNING_SCHEMA implementation
- Vendor reputation tracking
- Market knowledge base

---

## 4. Refactoring Plan

### Phase 1: Core Tool Integration (Priority: CRITICAL)

**Tasks:**
1. ✅ Integrate Google Search grounding
2. ✅ Integrate Google Maps grounding
3. ✅ Add `save_candidates` tool
4. ✅ Update agent to use tools in AI calls
5. ✅ Implement tool execution handler

**Files to Modify:**
- `supabase/functions/notify-buyers/core/agent.ts`
- `supabase/functions/notify-buyers/index.ts`

**Dependencies:**
- `supabase/functions/_shared/buy-sell-tools.ts` (already exists)
- Google API keys (GOOGLE_SEARCH_API_KEY, GOOGLE_MAPS_API_KEY)

### Phase 2: Multi-Model Strategy (Priority: CRITICAL)

**Tasks:**
1. ✅ Separate intent extraction (Flash) from deep reasoning (Pro)
2. ✅ Add thinking budget configuration (32k for Pro)
3. ✅ Implement model selection logic
4. ✅ Update system prompts for each model

**Files to Modify:**
- `supabase/functions/notify-buyers/core/agent.ts`
- `supabase/functions/_shared/agents/marketplace-ai-provider.ts`

### Phase 3: Voice Note Support (Priority: CRITICAL)

**Tasks:**
1. ✅ Detect audio messages in webhook
2. ✅ Download audio from WhatsApp
3. ✅ Transcribe using Gemini 2.5 Flash Native Audio
4. ✅ Process transcribed text through agent

**Files to Modify:**
- `supabase/functions/notify-buyers/index.ts`
- `supabase/functions/notify-buyers/core/agent.ts`

**Dependencies:**
- WhatsApp media API access
- Gemini API with audio support

### Phase 4: Geo-Fencing & Access Control (Priority: CRITICAL)

**Tasks:**
1. ✅ Implement LPM phone number resolution
2. ✅ Add country validation
3. ✅ Block UG, KE, NG, ZA (or redirect)
4. ✅ Add geo-fencing to system prompt

**Files to Modify:**
- `supabase/functions/notify-buyers/core/agent.ts`
- `supabase/functions/notify-buyers/index.ts`
- Create: `supabase/functions/notify-buyers/utils/geo-fencing.ts`

### Phase 5: Vendor Tier System (Priority: HIGH)

**Tasks:**
1. ✅ Classify vendors as Tier 1 (verified) or Tier 2 (public)
2. ✅ Separate results presentation
3. ✅ Update search logic to prioritize Tier 1

**Files to Modify:**
- `supabase/functions/notify-buyers/core/agent.ts`
- Database schema (if needed)

### Phase 6: Vendor Outreach (Priority: HIGH)

**Tasks:**
1. ✅ Implement vendor broadcasting
2. ✅ Handle "HAVE IT" button responses
3. ✅ Notify user when match found
4. ✅ Add rate limiting for broadcasts

**Files to Modify:**
- `supabase/functions/notify-buyers/core/agent.ts`
- `supabase/functions/notify-buyers/handlers/vendor-response-handler.ts` (may exist)

### Phase 7: Structured Learning (Priority: MEDIUM)

**Tasks:**
1. ✅ Implement LEARNING_SCHEMA
2. ✅ Track vendor reputation
3. ✅ Store market intelligence
4. ✅ Build intelligence hub

**Files to Modify:**
- `supabase/functions/notify-buyers/core/agent.ts`
- Database schema (if needed)

---

## 5. Implementation Details

### 5.1 Tool Integration Pattern

```typescript
// agent.ts - Add tools to AI calls
const response = await this.aiProvider.chat(messages, {
  temperature: AI_TEMPERATURE,
  maxTokens: AI_MAX_TOKENS,
  tools: SOURCING_TOOLS_CONFIG.tools, // ✅ Add this
  toolConfig: SOURCING_TOOLS_CONFIG.toolConfig, // ✅ Add this
  metadata: { agent: "buy_sell" },
});

// Handle function calls
if (response.functionCalls) {
  for (const call of response.functionCalls) {
    if (call.name === "save_candidates") {
      await executeSaveCandidates(call.args, { supabase, correlationId });
    }
  }
}
```

### 5.2 Multi-Model Strategy Pattern

```typescript
// Intent extraction (fast)
const intentResponse = await flashModel.generateContent({
  model: "gemini-3-flash",
  systemInstruction: SYSTEM_INSTRUCTION_INTENT,
  prompt: userMessage,
});

// Deep reasoning (if needed)
if (requiresDeepReasoning(intentResponse)) {
  const reasoningResponse = await proModel.generateContent({
    model: "gemini-3-pro",
    systemInstruction: SYSTEM_INSTRUCTION_RESPONSE,
    thinkingBudget: 32000, // 32k thinking budget
    tools: SOURCING_TOOLS_CONFIG.tools,
    prompt: buildReasoningPrompt(intentResponse, context),
  });
}
```

### 5.3 Voice Note Pattern

```typescript
// index.ts - Handle audio messages
if (message.type === "audio" && message.audio) {
  const audioId = message.audio.id;
  const audioUrl = await getWhatsAppMediaUrl(audioId);
  const audioBuffer = await downloadAudio(audioUrl);
  
  // Transcribe with Gemini 2.5 Flash Native Audio
  const transcription = await transcribeWithGemini(audioBuffer, {
    model: "gemini-2.5-flash-native-audio-preview-09-2025",
  });
  
  // Process transcribed text
  const agent = new MarketplaceAgent(supabase, correlationId);
  const response = await agent.process(transcription, context);
}
```

### 5.4 Geo-Fencing Pattern

```typescript
// utils/geo-fencing.ts
export function resolveCountryFromPhone(phone: string): string | null {
  // LPM: Longest Prefix Match
  // +250... → RW
  // +233... → GH
  // +256... → UG (BLOCKED)
  // etc.
}

export function validateAccess(phone: string): { allowed: boolean; reason?: string } {
  const country = resolveCountryFromPhone(phone);
  if (!country) return { allowed: false, reason: "Invalid phone number" };
  
  const BLOCKED_COUNTRIES = ["UG", "KE", "NG", "ZA"];
  if (BLOCKED_COUNTRIES.includes(country)) {
    return { allowed: false, reason: `Service not available in ${country}` };
  }
  
  return { allowed: true };
}
```

---

## 6. Testing Strategy

### 6.1 Unit Tests
- Tool execution (save_candidates)
- Geo-fencing logic
- Model selection
- Voice transcription

### 6.2 Integration Tests
- End-to-end sourcing workflow
- Vendor outreach flow
- Multi-model reasoning

### 6.3 UAT Scenarios
1. **Voice Note Sourcing**: User sends voice note → Transcription → Sourcing → Results
2. **Geo-Blocking**: User from Uganda → Blocked message
3. **Tier Separation**: Search → Tier 1 vs Tier 2 results
4. **Vendor Outreach**: User requests → Broadcast → Vendor responds → Match found

---

## 7. Deployment Checklist

- [ ] Google API keys configured (Search, Maps)
- [ ] Gemini API key with audio support
- [ ] Database tables created (candidate_vendors, vendor_reputation, etc.)
- [ ] Environment variables set
- [ ] Function deployed
- [ ] Health checks passing
- [ ] UAT scenarios validated

---

## 8. Success Metrics

- **Tool Usage**: 80%+ of sourcing requests use Google Search/Maps
- **Voice Adoption**: 30%+ of requests via voice notes
- **Geo-Compliance**: 100% blocked requests from UG/KE/NG/ZA
- **Vendor Outreach**: 50%+ match rate from Tier 1 vendors
- **Response Time**: <3s for intent extraction, <10s for deep reasoning

---

## 9. Next Steps

1. **Immediate**: Implement Phase 1 (Tool Integration) - **CRITICAL**
2. **Week 1**: Implement Phase 2-3 (Multi-Model + Voice) - **CRITICAL**
3. **Week 2**: Implement Phase 4 (Geo-Fencing) - **CRITICAL**
4. **Week 3**: Implement Phase 5-6 (Vendor Tiers + Outreach) - **HIGH**
5. **Week 4**: Implement Phase 7 (Learning) - **MEDIUM**

---

**Report Generated**: 2025-01-XX
**Status**: Ready for Implementation
**Priority**: CRITICAL - Production blocker without these features

