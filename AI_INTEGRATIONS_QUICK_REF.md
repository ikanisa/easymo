# AI Integrations Quick Reference

## 🚀 Quick Start

```bash
# 1. Set environment variables
export GOOGLE_CLOUD_API_KEY=your-key
export OPENAI_API_KEY=your-key
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-key
export TWILIO_ACCOUNT_SID=your-sid
export TWILIO_AUTH_TOKEN=your-token

# 2. Deploy everything
./deploy-ai-integrations.sh

# 3. Configure Twilio webhooks in console
# 4. Test!
```

## 📞 Testing

### Test WhatsApp Voice Message
1. Send voice message to WhatsApp bot
2. Should get voice response (uses Google TTS)
3. Check logs: `supabase functions logs wa-agent-call-center`

### Test Phone Call
1. Call your Twilio number
2. Should connect to AI agent
3. Try asking: "Schedule a ride from Kigali to Airport"
4. AI should execute `schedule_ride` tool

## 🔧 Feature Flags

### Use Google AI (default: enabled)
```bash
# Enable (default)
export USE_GOOGLE_AI=true

# Disable (use only OpenAI)
export USE_GOOGLE_AI=false
```

### Use AGI Tools (default: enabled)
```bash
# Enable full Call Center AGI
export CALL_CENTER_USE_AGI=true

# Disable (basic agent only)
export CALL_CENTER_USE_AGI=false
```

## 🗂️ File Structure

```
supabase/functions/
├── wa-agent-call-center/
│   ├── google-stt-integration.ts       # Google Speech-to-Text
│   ├── google-translate-integration.ts # Google Translate
│   ├── google-tts-integration.ts       # Google Text-to-Speech
│   └── index.ts                         # Main handler (updated)
├── twilio-voice-webhook/
│   └── index.ts                         # Twilio webhook handler
└── _shared/
    └── voice-handler.ts                 # Multi-provider voice (updated)

services/voice-gateway/src/
├── agi-bridge.ts                        # AGI tool executor
├── realtime-functions.ts                # OpenAI Realtime tools
├── sip-handler.ts                       # SIP call handler
├── session.ts                           # Call session (updated)
└── server.ts                            # HTTP/WS server (updated)
```

## 🎯 Integration Flow

### WhatsApp Voice Message
```
User Voice → WhatsApp → wa-agent-call-center
                             ↓
                    Google STT (primary)
                             ↓ (fallback)
                    OpenAI Whisper
                             ↓
                    Call Center AGI (tools)
                             ↓
                    Google TTS (primary)
                             ↓ (fallback)
                    OpenAI TTS
                             ↓
                    Voice Response → WhatsApp → User
```

### Phone Call (SIP)
```
Phone → Twilio → twilio-voice-webhook → Voice Gateway
                                              ↓
                                    OpenAI Realtime API
                                              ↓
                                        AGI Bridge
                                              ↓
                                   Call Center AGI Tools
                                   (20 tools available)
```

## 📊 Available Tools

| Tool | Description | Example |
|------|-------------|---------|
| `get_profile` | User profile | "What's my profile?" |
| `schedule_ride` | Book a ride | "I need a ride to the airport" |
| `check_ride_status` | Track ride | "Where's my driver?" |
| `cancel_ride` | Cancel ride | "Cancel my ride" |
| `get_nearby_drivers` | Find drivers | "Are there drivers near me?" |
| `search_vehicles` | Find vehicles | "Show me cars under 10M RWF" |
| `get_vehicle_details` | Vehicle info | "Tell me about this Toyota" |
| `create_insurance_quote` | Get quote | "How much to insure my car?" |
| `search_properties` | Find properties | "Show me houses in Kigali" |
| `search_jobs` | Find jobs | "Any IT jobs available?" |
| `get_farming_advice` | Farming tips | "How to grow maize?" |
| `search_equipment` | Farm equipment | "Need a tractor to rent" |
| `get_help` | General help | "How do I use EasyMO?" |

## 🌍 Multi-Language Support

### Automatic Detection
System auto-detects language from:
- Voice audio (Google STT)
- Text content (Google Translate)
- User profile preferences

### Supported Languages
- **rw** - Kinyarwanda (primary)
- **en** - English
- **fr** - French
- **sw** - Swahili

### Voice Personas
- `rw-RW-Standard-A` - Kinyarwanda Female
- `en-US-Neural2-F` - English Female
- `fr-FR-Neural2-A` - French Female
- `sw-KE-Standard-A` - Swahili Female

## 💰 Cost Breakdown

### Per-Minute Costs

| Component | Provider | Cost/Min |
|-----------|----------|----------|
| Speech-to-Text | Google | $0.024 |
| Text-to-Speech | Google | $0.001 |
| Translation | Google | $0.001 |
| Realtime API | OpenAI | $0.300 |
| Phone Calls | Twilio | $0.038 |
| **Total (Phone)** | | **~$0.364** |
| **Total (WhatsApp)** | | **~$0.026** |

### Monthly Estimates

| Usage | Cost |
|-------|------|
| 100 calls/day (5 min avg) | ~$546/month |
| 500 WhatsApp voice msgs/day | ~$390/month |
| Combined | ~$936/month |

### Optimization Tips
1. Use Google AI (cheaper than OpenAI for voice)
2. Enable feature flag to control providers
3. Set max call duration limits
4. Cache frequent translations

## 🔍 Debugging

### Check Logs
```bash
# Call Center AGI
supabase functions logs wa-agent-call-center

# Twilio Webhook
supabase functions logs twilio-voice-webhook

# Voice Gateway (if on Cloud Run)
gcloud run services logs read voice-gateway --region us-central1
```

### Common Issues

**Google STT fails:**
- Check `GOOGLE_CLOUD_API_KEY` is set
- Verify API is enabled in GCP Console
- Falls back to OpenAI Whisper automatically

**Realtime not executing tools:**
- Check AGI Bridge logs
- Verify tool names match mapping
- Ensure Call Center AGI is deployed

**Twilio calls not connecting:**
- Verify webhook URLs in Twilio Console
- Check `TWILIO_AUTH_TOKEN` is correct
- Ensure Voice Gateway is accessible

## 📈 Monitoring

### Key Metrics

**Log Events:**
- `google_stt.success` - Successful transcription
- `google_tts.success` - Successful TTS
- `realtime.tool_call_received` - Tool call from AI
- `agi_bridge.tool_execution_success` - Tool executed
- `twilio.call.incoming` - Incoming phone call
- `sip.call_connected` - Call connected to AI

**Database Tables:**
- `calls` - Call records
- `call_transcripts` - Conversation transcripts
- `ai_tool_executions` - Tool usage analytics

### Health Checks

```bash
# Twilio webhook
curl https://your-project.supabase.co/functions/v1/twilio-voice-webhook/health

# Call Center AGI
curl https://your-project.supabase.co/functions/v1/wa-agent-call-center/health

# Voice Gateway
curl https://voice-gateway-url.com/health
```

## 🎉 Success Indicators

- ✅ Voice messages transcribed correctly
- ✅ Responses in user's language
- ✅ Tools executed during calls
- ✅ Phone calls connect to AI
- ✅ Logs showing successful events
- ✅ No fallback errors (unless expected)

## 📚 Additional Resources

- [AI_INTEGRATIONS_COMPLETE.md](AI_INTEGRATIONS_COMPLETE.md) - Full implementation details
- [CALL_CENTER_AGI_MISSING_INTEGRATIONS_AUDIT.md](CALL_CENTER_AGI_MISSING_INTEGRATIONS_AUDIT.md) - Original audit
- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [Google Cloud Speech-to-Text](https://cloud.google.com/speech-to-text)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/twiml/stream)
