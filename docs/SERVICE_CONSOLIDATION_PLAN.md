# Service Consolidation Plan
**Date:** December 10, 2025
**Current:** 24 services
**Target:** 15-18 services
**Reduction:** 6-9 services

## Voice/Media Services Analysis (5 → 2)

### Current Services
```
services/
├── voice-bridge/           # Voice handling
├── voice-gateway/          # Voice gateway
├── voice-media-bridge/     # Voice media bridge
├── voice-media-server/     # Voice media server
├── whatsapp-voice-bridge/  # WhatsApp voice bridge
```

### Analysis Required
### voice-bridge
```json
{
  "name": "@easymo/voice-bridge",
  "description": null,
  "dependencies": [
    "@easymo/circuit-breaker",
    "@easymo/commons",
    "@supabase/supabase-js",
    "dotenv",
    "express",
    "pino",
    "pino-http",
    "ws",
    "zod"
  ]
}
```

### voice-gateway
```json
{
  "name": "@easymo/voice-gateway",
  "description": "Voice Gateway service for SIP/WebRTC telephony bridge",
  "dependencies": [
    "@easymo/call-capability",
    "@easymo/google-speech",
    "@supabase/supabase-js",
    "dotenv",
    "express",
    "pino",
    "pino-pretty",
    "uuid",
    "ws"
  ]
}
```

### voice-media-bridge
```json
{
  "name": "@easymo/voice-media-bridge",
  "description": "WebRTC media bridge between WhatsApp and OpenAI Realtime API",
  "dependencies": [
    "@types/node",
    "dotenv",
    "express",
    "pino",
    "ws"
  ]
}
```

### voice-media-server
```json
{
  "name": "@easymo/voice-media-server",
  "description": "WebRTC media server for WhatsApp calls bridged to OpenAI Realtime API",
  "dependencies": [
    "@roamhq/wrtc",
    "@supabase/supabase-js",
    "dotenv",
    "express",
    "pino",
    "ws"
  ]
}
```

### whatsapp-voice-bridge
```json
{
  "name": "@easymo/whatsapp-voice-bridge",
  "description": "WebRTC media bridge for WhatsApp voice calls to OpenAI Realtime API",
  "dependencies": [
    "@supabase/supabase-js",
    "dotenv",
    "express",
    "pino",
    "pino-pretty",
    "wrtc",
    "ws"
  ]
}
```


## Consolidation Analysis

### Identified Duplicates

#### Group 1: WhatsApp Voice Bridges (3 → 1)
**Overlapping services:**
- `voice-media-bridge` - WhatsApp to OpenAI bridge
- `voice-media-server` - WhatsApp WebRTC media server
- `whatsapp-voice-bridge` - WhatsApp voice to OpenAI bridge

**All three:**
- Use WebRTC (`wrtc` or `@roamhq/wrtc`)
- Bridge WhatsApp calls to OpenAI Realtime API
- Use WebSocket (`ws`)
- Use Express
- Use Pino logging

**Recommendation:** 
```
CONSOLIDATE → @easymo/whatsapp-media-server
- Merge all three into single service
- Handle WebRTC ↔ OpenAI bridging
- Estimated savings: 2 services
```

#### Group 2: Voice Infrastructure (2 services - KEEP SEPARATE)
- `voice-bridge` - General voice handling (no SIP)
- `voice-gateway` - SIP/WebRTC telephony gateway (uses @easymo/google-speech)

**Recommendation:** **KEEP SEPARATE**
- Different protocols (SIP vs general)
- voice-gateway has specialized dependencies (Google Speech)
- Serve different purposes

## Other Service Analysis

### OpenAI Services (2 services)
#### openai-deep-research-service
```json
{
  "name": "@easymo/openai-deep-research",
  "description": "OpenAI Deep Research service for autonomous web intelligence"
}
```
#### openai-responses-service
```json
{
  "name": "@easymo/openai-responses-service",
  "description": "OpenAI Responses API service for summarization, matching, and entity extraction"
}
```

**Analysis:**
- `openai-deep-research-service` - Deep research tasks
- `openai-responses-service` - Response generation

**Recommendation:** **KEEP SEPARATE** (different use cases)

## Summary

### Immediate Consolidation Opportunities
| Group | Current | Target | Savings |
|-------|---------|--------|---------|
| WhatsApp Voice Bridges | 3 | 1 | -2 services |
| **TOTAL** | **24** | **22** | **-2 services** |

### Conservative Approach
- Focus on clear duplicates only
- WhatsApp voice bridges are obvious consolidation
- Keep specialized services separate (SIP gateway, research, etc.)

### Next Steps
1. Create unified `whatsapp-media-server` structure
2. Migrate code from 3 services
3. Update docker-compose files
4. Test thoroughly
5. Archive old services

