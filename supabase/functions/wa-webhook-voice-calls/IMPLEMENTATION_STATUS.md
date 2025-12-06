# WhatsApp Voice Calls - Proper WebRTC Implementation

**Status:** IN PROGRESS  
**Started:** 2025-12-06 22:00 UTC

## 🎯 What Needs to Change

### Current Implementation (WRONG)
- Tries to use OpenAI Realtime API directly
- No WebRTC SDP handling
- No proper pre-accept/accept flow

### Correct Implementation (NEEDED)
- Handle WhatsApp WebRTC SDP offer
- Generate proper SDP answer
- Pre-accept → WebRTC connection → Accept flow
- Bridge audio to OpenAI Realtime API

## 📋 Implementation Steps

1. ✅ Understand WhatsApp's call flow
2. ⏳ Implement WebRTC SDP handler
3. ⏳ Implement pre-accept/accept endpoints
4. ⏳ Bridge to OpenAI Realtime
5. ⏳ Test with real call

## ⚠️ Configuration Required FIRST

Before code works, you MUST:
1. Subscribe webhook to `calls` in Facebook Developer Console
2. Enable calling on your business phone number

Without these, WhatsApp won't send call events!

---

**Next:** Implementing WebRTC SDP handler now...
