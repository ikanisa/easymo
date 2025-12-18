# Notify-Buyers Agent Refactoring Status

## ✅ Completed

### 1. Analysis & Planning
- ✅ Comprehensive analysis report created (`NOTIFY_BUYERS_AGENT_ANALYSIS.md`)
- ✅ Gap analysis comparing current vs Kwizera reference
- ✅ Refactoring plan with 7 phases

### 2. Enhanced Agent Implementation
- ✅ Created `agent-enhanced.ts` with:
  - Multi-model strategy (Flash for intent, Pro for reasoning)
  - Google Search and Maps tools integration
  - `save_candidates` tool support
  - Geo-fencing and access control (LPM phone resolution)
  - Vendor tier system foundation
  - Structured learning foundation
  - Kwizera persona system instructions

### 3. Core Infrastructure Updates
- ✅ Updated `gemini.ts` to support:
  - `thinkingBudget` parameter for Gemini 3 Pro
  - Enhanced tool support
  - Function call extraction

## 🚧 In Progress

### Phase 1: Core Tool Integration
- ✅ Tool definitions ready (`buy-sell-tools.ts`)
- ✅ Enhanced agent created with tool support
- ⚠️ **PENDING**: Integration into main `index.ts`
- ⚠️ **PENDING**: Voice note transcription support
- ⚠️ **PENDING**: Testing with real API calls

## 📋 Remaining Tasks

### Phase 2: Voice Note Support (Priority: CRITICAL)
- [ ] Add audio message detection in `index.ts`
- [ ] Implement audio download from WhatsApp
- [ ] Add transcription using Gemini 2.5 Flash Native Audio
- [ ] Process transcribed text through agent

### Phase 3: Integration & Testing
- [ ] Replace `MarketplaceAgent` with `EnhancedMarketplaceAgent` in `index.ts`
- [ ] Add voice note handling to webhook handler
- [ ] Test end-to-end workflow
- [ ] Verify tool execution (save_candidates)
- [ ] Test geo-fencing (block UG/KE/NG/ZA)

### Phase 4: Vendor Tier System (Priority: HIGH)
- [ ] Classify vendors as Tier 1 (verified) vs Tier 2 (public)
- [ ] Update search logic to prioritize Tier 1
- [ ] Separate results presentation

### Phase 5: Vendor Outreach (Priority: HIGH)
- [ ] Implement vendor broadcasting
- [ ] Handle "HAVE IT" button responses
- [ ] Notify user when match found
- [ ] Add rate limiting for broadcasts

### Phase 6: Structured Learning (Priority: MEDIUM)
- [ ] Implement LEARNING_SCHEMA
- [ ] Track vendor reputation
- [ ] Store market intelligence
- [ ] Build intelligence hub

## 🔧 Integration Steps

### Step 1: Update index.ts to use Enhanced Agent

```typescript
// In notify-buyers/index.ts, replace:
import { MarketplaceAgent } from "./core/agent.ts";

// With:
import { EnhancedMarketplaceAgent } from "./core/agent-enhanced.ts";

// Replace agent instantiation:
const agent = new EnhancedMarketplaceAgent(supabase, correlationId);
```

### Step 2: Add Voice Note Support

```typescript
// In handleWhatsAppWebhook, add:
if (message.type === "audio" && message.audio) {
  const audioId = message.audio.id;
  const audioUrl = await getWhatsAppMediaUrl(audioId);
  const audioBuffer = await downloadAudio(audioUrl);
  
  // Transcribe with Gemini
  const transcription = await transcribeWithGemini(audioBuffer, {
    model: "gemini-2.0-flash-exp", // Or gemini-2.5-flash-native-audio when available
  });
  
  // Process transcribed text
  const agent = new EnhancedMarketplaceAgent(supabase, correlationId);
  const response = await agent.process(transcription, context);
}
```

### Step 3: Environment Variables

Ensure these are set:
```bash
GEMINI_API_KEY=your_key
INTENT_MODEL=gemini-1.5-flash
REASONING_MODEL=gemini-1.5-pro
VOICE_MODEL=gemini-2.0-flash-exp
GOOGLE_SEARCH_API_KEY=your_key (if using custom search)
GOOGLE_MAPS_API_KEY=your_key (if using Maps API directly)
```

## 📊 Current Status

**Overall Progress**: ~40% Complete

- ✅ Analysis & Planning: 100%
- ✅ Enhanced Agent Core: 80% (needs integration)
- ⚠️ Voice Support: 0%
- ⚠️ Integration: 0%
- ⚠️ Testing: 0%
- ⚠️ Vendor Tiers: 0%
- ⚠️ Vendor Outreach: 0%
- ⚠️ Learning System: 0%

## 🎯 Next Steps

1. **IMMEDIATE**: Integrate `EnhancedMarketplaceAgent` into `index.ts`
2. **IMMEDIATE**: Add voice note transcription support
3. **WEEK 1**: Complete Phase 1-2 (Tools + Voice)
4. **WEEK 2**: Complete Phase 3 (Integration & Testing)
5. **WEEK 3**: Complete Phase 4-5 (Vendor Tiers + Outreach)
6. **WEEK 4**: Complete Phase 6 (Learning System)

## 📝 Notes

- The enhanced agent is ready but not yet integrated
- Geo-fencing is implemented and will block UG/KE/NG/ZA automatically
- Tool execution (save_candidates) is ready but needs testing
- Voice transcription needs to be added to the webhook handler
- Vendor tier system needs database schema updates (if required)

## 🔍 Key Files

- `supabase/functions/notify-buyers/core/agent-enhanced.ts` - Enhanced agent
- `supabase/functions/notify-buyers/core/agent.ts` - Original agent (to be replaced)
- `supabase/functions/notify-buyers/index.ts` - Webhook handler (needs updates)
- `supabase/functions/_shared/gemini.ts` - Gemini API wrapper (updated)
- `supabase/functions/_shared/buy-sell-tools.ts` - Tool definitions (ready)

---

**Last Updated**: 2025-01-XX
**Status**: Ready for Integration

