# WhatsApp Voice Calls - Full WebRTC Implementation Plan

**Date:** 2025-12-06 22:23 UTC  
**Status:** STARTING FULL IMPLEMENTATION  
**Goal:** Complete audio bridge for WhatsApp voice calls

---

## ✅ REQUIREMENTS CONFIRMED

1. **Implement WhatsApp voice calling FULLY** (Custom WebRTC)
2. **Keep SIP calling ready** (waiting for MTN/GO credentials)
3. **Use OpenAI Realtime API** (NOT the SIP endpoint - that's for SIP only)
4. **Full control** over implementation

---

## 🎯 ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                  WHATSAPP VOICE CALL FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User calls via WhatsApp                                     │
│     ↓                                                            │
│  2. WhatsApp sends webhook with SDP offer                       │
│     ↓                                                            │
│  3. wa-webhook-voice-calls receives call                        │
│     ↓                                                            │
│  4. Generate SDP answer (✅ DONE)                               │
│     ↓                                                            │
│  5. Pre-accept & Accept call (✅ DONE)                          │
│     ↓                                                            │
│  6. Establish WebRTC connection                                 │
│     ↓                                                            │
│  7. Receive RTP audio packets from WhatsApp                     │
│     ↓                                                            │
│  8. Connect to OpenAI Realtime WebSocket                        │
│     wss://api.openai.com/v1/realtime                            │
│     ↓                                                            │
│  9. Convert RTP audio → Base64 PCM → OpenAI                     │
│     ↓                                                            │
│ 10. Receive AI audio from OpenAI                                │
│     ↓                                                            │
│ 11. Convert Base64 PCM → RTP audio                              │
│     ↓                                                            │
│ 12. Send RTP packets to WhatsApp                                │
│     ↓                                                            │
│ 13. User hears AI voice                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 IMPLEMENTATION PHASES

### Phase 2.1: WebRTC Media Server (DAY 1)
**Tasks:**
- [ ] Set up WebRTC peer connection handler
- [ ] Implement DTLS/SRTP for secure media
- [ ] Handle ICE candidates
- [ ] Receive RTP audio packets from WhatsApp
- [ ] Send RTP audio packets to WhatsApp

**Technologies:**
- `werift` (WebRTC for Deno) OR
- `node-webrtc` (if we use Node.js service)
- RTP packet handling
- Audio codec support (PCMU, PCMA, Opus)

### Phase 2.2: Audio Processing (DAY 1-2)
**Tasks:**
- [ ] Decode RTP audio packets (G.711, Opus)
- [ ] Convert to PCM format
- [ ] Resample to 24kHz (OpenAI Realtime requirement)
- [ ] Encode PCM to Base64
- [ ] Reverse: Base64 → PCM → RTP

**Technologies:**
- FFmpeg for transcoding OR
- `@discordjs/opus` for Opus codec
- Audio resampling libraries

### Phase 2.3: OpenAI Realtime Integration (DAY 2)
**Tasks:**
- [ ] Connect to OpenAI Realtime WebSocket
- [ ] Send audio chunks (base64 PCM)
- [ ] Receive AI responses
- [ ] Handle conversation state
- [ ] Manage interruptions

**Already have:**
- ✅ OpenAI API key
- ✅ Organization ID: org-4Kr7lOqpDhJErYgyGzwgSduN
- ✅ Model: gpt-5-realtime

### Phase 2.4: Bidirectional Audio Bridge (DAY 2-3)
**Tasks:**
- [ ] Continuous audio streaming (WhatsApp → OpenAI)
- [ ] Continuous audio streaming (OpenAI → WhatsApp)
- [ ] Handle latency and buffering
- [ ] Echo cancellation
- [ ] Voice Activity Detection (VAD)

### Phase 2.5: Testing & Optimization (DAY 3)
**Tasks:**
- [ ] End-to-end call testing
- [ ] Audio quality verification
- [ ] Latency optimization
- [ ] Error handling
- [ ] Production deployment

---

## 🛠️ TECHNICAL DECISIONS

### 1. Where to Run WebRTC Server?

**Option A: Supabase Edge Function** (PREFERRED)
- Pros: Same infrastructure, easy deployment
- Cons: Limited WebRTC support in Deno runtime
- **Verdict:** Try first, may have limitations

**Option B: Separate Node.js Service**
- Pros: Better WebRTC library support
- Cons: Additional infrastructure
- **Verdict:** Fallback if Edge Functions can't handle it

**Option C: Deno Deploy**
- Pros: Good Deno support, scalable
- Cons: WebRTC support unclear
- **Verdict:** Consider if A fails

### 2. Audio Codec Strategy

WhatsApp supports: PCMU (G.711 μ-law), PCMA (G.711 A-law), Opus
OpenAI Realtime needs: 24kHz PCM

**Pipeline:**
```
WhatsApp RTP (G.711/Opus) 
  → Decode to PCM
  → Resample to 24kHz
  → Base64 encode
  → Send to OpenAI

OpenAI Base64 PCM
  → Base64 decode
  → Resample to 8kHz
  → Encode to G.711
  → RTP packets
  → Send to WhatsApp
```

### 3. WebRTC Library Choice

**For Deno/Edge:**
- Try `werift` - WebRTC implementation for Deno

**For Node.js (if needed):**
- `node-webrtc` - Full WebRTC stack
- `wrtc` - Alternative

---

## 📦 IMPLEMENTATION FILES

```
supabase/functions/
├── wa-webhook-voice-calls/
│   ├── index.ts                    ✅ (webhook handler)
│   ├── sdp-handler.ts               ✅ (SDP generation)
│   ├── webrtc-server.ts            ⏳ (WebRTC peer connection)
│   ├── audio-processor.ts          ⏳ (RTP ↔ PCM conversion)
│   ├── openai-realtime-bridge.ts   ⏳ (OpenAI WebSocket)
│   └── call-session.ts             ⏳ (Session management)
```

---

## 🚀 STARTING IMPLEMENTATION NOW

### Immediate Next Steps:

1. **Research**: Test if Deno Edge Functions can handle WebRTC
2. **Prototype**: Simple RTP packet handling
3. **Decision**: Edge Functions or separate service?
4. **Implement**: Based on decision

---

## ⚠️ POTENTIAL CHALLENGES

1. **Deno WebRTC Support**: May be limited
2. **Audio Processing**: Need FFmpeg or audio libraries
3. **Latency**: Real-time audio requires <200ms latency
4. **NAT Traversal**: ICE candidate handling
5. **Codec Complexity**: G.711/Opus encoding/decoding

---

## 📊 ESTIMATED TIMELINE

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| 2.1: WebRTC Server | 1 day | Now | +24h |
| 2.2: Audio Processing | 1 day | +24h | +48h |
| 2.3: OpenAI Integration | 0.5 day | +48h | +60h |
| 2.4: Bidirectional Bridge | 1 day | +60h | +84h |
| 2.5: Testing | 0.5 day | +84h | +96h |
| **TOTAL** | **4 days** | Now | +96h |

**Estimated completion: December 10, 2025**

---

## 🎯 SUCCESS CRITERIA

- [ ] User can call WhatsApp business number
- [ ] Call connects (✅ ALREADY WORKING)
- [ ] User hears AI voice clearly
- [ ] AI hears user voice clearly
- [ ] Conversation is natural (<300ms latency)
- [ ] No audio dropouts or distortion
- [ ] Handles interruptions properly
- [ ] Works reliably for 5+ minute calls

---

**STARTING IMPLEMENTATION NOW!**

First: Test WebRTC capabilities in Deno Edge Functions...

