# Refactoring Updates - Based on Code Review

## ✅ Updates Applied

### 1. Enhanced `save_candidates` Tool
- ✅ Added `final_response_text` parameter (required)
- ✅ Added `google_maps_uri` field to candidate schema
- ✅ Added `is_onboarded` field (required, boolean)
- ✅ Updated source enum: `["google_maps", "google_search", "internal_db"]`
- ✅ Tool now returns `finalResponseText` for atomic save+response

### 2. Tool Configuration Format
- ✅ Changed `SOURCING_TOOLS_CONFIG` to array format:
  ```typescript
  [
    { googleSearch: {} },
    { googleMaps: {} },
    { functionDeclarations: [SAVE_CANDIDATES_DECLARATION] }
  ]
  ```
- ✅ Separated `SOURCING_TOOL_CONFIG` for function calling config

### 3. Response Handling
- ✅ Updated `generateContent` to return both `text` and `functionCalls` when both present
- ✅ Agent now extracts `final_response_text` from `save_candidates` tool call
- ✅ Uses `final_response_text` as the user message when available

### 4. Tool Execution
- ✅ `executeSaveCandidates` now returns `finalResponseText`
- ✅ Agent uses tool's `final_response_text` instead of generating its own

## 📋 Still Missing (To Be Implemented)

### 1. Voice Bridge Support
- [ ] `GeminiVoiceBridge` class for Gemini Live API
- [ ] Voice note transcription using `gemini-2.5-flash-native-audio-preview-09-2025`
- [ ] Audio encoding/decoding utilities

### 2. User Context Fetching
- [ ] `fetchUserContext()` function to get:
  - Past requests from `sourcing_requests` table
  - Market knowledge from `market_knowledge` table
- [ ] Integration into agent prompts

### 3. Vendor Outreach/Broadcasting
- [ ] WhatsApp broadcast handler (using Meta API, not Twilio)
- [ ] Rate limiting (1 hour window)
- [ ] Opt-in/opt-out checking
- [ ] Vendor response handling ("HAVE IT" button)

### 4. Job Queue Pattern
- [ ] `get_next_job` RPC function
- [ ] Job status updates (completed, failed)
- [ ] Error handling and retry logic

### 5. Type Definitions
- [ ] `WhatsAppMessage` interface
- [ ] `ExtractedIntent` interface
- [ ] `VendorCandidate` interface
- [ ] `Vendor` interface
- [ ] `VendorInquiry` interface
- [ ] `VendorResponse` interface

## 🔧 Next Steps

1. **Add Voice Support** - Implement `GeminiVoiceBridge` and audio transcription
2. **Add User Context** - Implement `fetchUserContext()` and integrate into agent
3. **Add Vendor Outreach** - Implement broadcast handler with Meta WhatsApp API
4. **Add Type Definitions** - Create shared types file
5. **Test Integration** - End-to-end testing with real API calls

## 📝 Notes

- Tool format now matches Gemini API requirements
- `final_response_text` ensures atomic save+response operation
- Response handling supports both text and function calls simultaneously
- All updates maintain backward compatibility where possible

---

**Last Updated**: 2025-01-XX
**Status**: Core updates complete, additional features pending

