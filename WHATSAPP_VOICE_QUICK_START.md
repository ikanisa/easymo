# WhatsApp Voice AI - Quick Start

## 🚀 One-Command Deploy

```bash
./deploy-whatsapp-voice.sh
```

## ✅ What Gets Deployed

1. **wa-agent-call-center** (Updated with Google AI)
   - Google Speech-to-Text (Kinyarwanda support)
   - Google Text-to-Speech (natural voices)
   - Google Translate (multi-language)
   - OpenAI fallback (automatic)
   - Call Center AGI (20 tools)

2. **Voice Gateway** (Optional - for WhatsApp calls)
   - OpenAI Realtime API integration
   - AGI Bridge for tool execution
   - Real-time voice conversations

## 📞 Test It

### Test 1: Send Voice Message
```
1. Open WhatsApp
2. Record message: "Muraho! Ndashaka taxi kuri Airport"
3. Send to bot
4. ✅ Get voice response back in Kinyarwanda
```

### Test 2: Different Languages
```
Kinyarwanda: "Ndashaka imodoka"
English: "I need a car"
French: "Je veux une voiture"
Swahili: "Nataka gari"
```

### Test 3: Tool Execution
```
"Schedule a ride from Kimihurura to Downtown Kigali"
→ AI should execute schedule_ride tool
→ Get confirmation
```

## 🔍 Monitor

```bash
# Watch logs
supabase functions logs wa-agent-call-center --tail

# Check tool executions
supabase db psql
SELECT * FROM ai_tool_executions ORDER BY created_at DESC LIMIT 5;
```

## 📊 What to Look For

**Success Indicators:**
- ✅ `google_stt.success` - Transcription worked
- ✅ `google_tts.success` - Voice response generated
- ✅ `agi.tool_execution` - Tool was called
- ✅ Voice message received on WhatsApp

**If Google Fails (Fallback):**
- ⚠️ `voice.transcribe.google_fallback` - Switched to OpenAI
- ✅ `voice.transcribe.openai_success` - OpenAI worked
- ✅ Still gets response (just via OpenAI)

## 💰 Cost Per Message

- Google STT: ~$0.01 per message
- Google TTS: ~$0.001 per response
- **Total: ~$0.011 per interaction**

(Much cheaper than OpenAI-only: $0.015)

## 🎯 Expected Behavior

| Input | Expected Output |
|-------|----------------|
| Kinyarwanda voice | Kinyarwanda voice response |
| English voice | English voice response |
| French voice | French voice response |
| "I need a ride" | Executes schedule_ride tool, confirms |
| "Show me cars" | Executes search_vehicles tool, lists cars |
| "Find a house" | Executes search_properties tool |

## 🔧 Troubleshooting

**No response received:**
```bash
# Check if function is deployed
curl https://your-project.supabase.co/functions/v1/wa-agent-call-center/health

# Check logs
supabase functions logs wa-agent-call-center --tail
```

**Google AI not working:**
```bash
# Verify API key is set
supabase secrets list | grep GOOGLE_CLOUD_API_KEY

# Check if fallback to OpenAI worked
# Look for: voice.transcribe.openai_success
```

**Tool not executing:**
```bash
# Check if AGI is enabled
supabase secrets list | grep CALL_CENTER_USE_AGI

# Should be: true (default)
```

## 📱 Phone Calls (Later)

**Not ready yet - waiting for MTN SIP trunk:**
- Twilio webhook handler: ✅ Built, not deployed
- SIP audio bridge: ✅ Built, ready
- MTN integration: ⏳ Waiting for credentials

**When MTN ready:**
```bash
export TWILIO_AUTH_TOKEN=xxx  # or MTN credentials
supabase functions deploy twilio-voice-webhook
# Configure MTN webhook URL
```

## 📚 More Info

- Full details: `AI_INTEGRATIONS_COMPLETE.md`
- Testing guide: `WHATSAPP_VOICE_TESTING_GUIDE.md`
- Quick ref: `AI_INTEGRATIONS_QUICK_REF.md`

---

**Status:** ✅ READY FOR WHATSAPP VOICE TESTING  
**Next:** Test with WhatsApp voice messages → Deploy phone calls when MTN ready
