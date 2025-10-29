# Voice Agent with OpenAI Realtime Integration

## Overview

The EasyMO Voice Agent is a production-ready service that connects Twilio (SIP/Media Streams) with OpenAI's Realtime API (gpt-4o-realtime-preview) to enable AI-powered voice conversations. The agent can execute backend tools via MCP (Model Context Protocol) and persists all call data in Supabase.

## Architecture

```
[Caller/PSTN]
   ↕ SIP/RTP
[Twilio Number → Elastic SIP / Media Streams]
   ↕ Webhook + WebSocket
[Voice Agent]
   ├─ HTTP: /health, /ready, /twilio/answer
   ├─ WebSocket: /ws/twilio (Twilio media stream)
   ├─ Realtime Client (wss://api.openai.com/v1/realtime)
   ├─ MCP Server (ws://localhost:9797/mcp)
   ├─ Supabase Edge Function: call-webhook
   └─ Feature flags, metrics, structured logging
```

## Features

### MVP (Development Ready)
- ✅ Inbound and outbound call flows
- ✅ WebSocket bridge: Twilio ⇄ OpenAI Realtime
- ✅ MCP tool server with Supabase operations
- ✅ Supabase Edge Function for call event capture
- ✅ Docker + Cloudflare Tunnel for public exposure
- ✅ Structured logging with correlation IDs
- ✅ Health and readiness checks
- ✅ Feature flags for incremental rollout

### Production Polish (Planned)
- 🔄 Enhanced μ-law→PCM16 conversion with quality controls
- 🔄 Full-duplex audio streaming
- 🔄 Barge-in detection and handling
- 🔄 Advanced backpressure control
- 🔄 Comprehensive load testing

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10.18.3+
- OpenAI API key with Realtime access
- Twilio account with Media Streams enabled
- Supabase project
- Cloudflare Tunnel token (for public exposure)

### Installation

```bash
# Navigate to voice-agent directory
cd apps/voice-agent

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env
```

### Environment Variables

Required variables (see `.env.example` for full list):

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview
OPENAI_REALTIME_VOICE=verse

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1234567890

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Public URL (from Cloudflare Tunnel)
PUBLIC_WS_URL=wss://your-tunnel-url.trycloudflare.com/ws/twilio

# Feature Flags
VOICE_AGENT_ENABLED=true
MCP_ENABLED=true
```

### Running Locally

```bash
# Development mode with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

The server will start on:
- HTTP: `http://localhost:8787`
- MCP WebSocket: `ws://localhost:9797`

### Docker Deployment

```bash
# Build and start with Docker Compose
docker compose up --build

# Check logs
docker compose logs -f voice-agent

# Stop services
docker compose down
```

The Cloudflare Tunnel will print the public hostname in the logs. Use this URL to configure your Twilio webhook.

## Twilio Configuration

### Step 1: Configure Webhook URL

1. Log into Twilio Console
2. Navigate to Phone Numbers → Active Numbers
3. Select your number
4. Under "Voice & Fax", set:
   - **A Call Comes In**: Webhook
   - **URL**: `https://your-tunnel-url.trycloudflare.com/twilio/answer`
   - **Method**: POST
5. Save

### Step 2: Test the Integration

Call your Twilio number. You should:
1. Hear "Connecting you to our AI assistant"
2. Be connected to the OpenAI Realtime agent
3. Have a voice conversation
4. See logs in the console and events in Supabase

## API Endpoints

### Health Check

```bash
GET /health

Response:
{
  "ok": true,
  "service": "voice-agent",
  "version": "0.1.0",
  "uptime": 123.45,
  "timestamp": "2025-10-29T20:00:00.000Z",
  "features": {
    "voiceAgent": true,
    "mcp": true
  }
}
```

### Readiness Check

```bash
GET /ready

Response: 200 OK (if configured) or 503 Service Unavailable
```

### Twilio Answer (TwiML)

```bash
POST /twilio/answer

Body: (Twilio call parameters)

Response: TwiML XML with <Connect><Stream>
```

## MCP Tool Server

The MCP server exposes tools via WebSocket on port 9797.

### Available Tools

#### get_member_balance

Get a member's savings account balance.

```json
{
  "id": "req_123",
  "method": "tool.call",
  "params": {
    "name": "get_member_balance",
    "args": {
      "memberId": "member_123"
    }
  }
}
```

Response:
```json
{
  "id": "req_123",
  "result": {
    "success": true,
    "memberId": "member_123",
    "balance": 50000,
    "currency": "RWF"
  }
}
```

#### redeem_voucher

Redeem a voucher code.

```json
{
  "id": "req_124",
  "method": "tool.call",
  "params": {
    "name": "redeem_voucher",
    "args": {
      "code": "SAVE2024"
    }
  }
}
```

Response:
```json
{
  "id": "req_124",
  "result": {
    "success": true,
    "code": "SAVE2024",
    "voucher": {
      "id": "voucher_123",
      "value": 1000,
      "type": "discount"
    }
  }
}
```

### List Available Tools

```json
{
  "id": "req_125",
  "method": "tools.list",
  "params": {}
}
```

## Database Schema

### calls Table

```sql
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT UNIQUE NOT NULL,
  from_number TEXT,
  to_number TEXT,
  direction TEXT,
  transcript TEXT,
  intent TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calls_call_sid ON calls(call_sid);
CREATE INDEX idx_calls_created_at ON calls(created_at DESC);
```

### call_events Table

```sql
CREATE TABLE IF NOT EXISTS call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_events_call_sid ON call_events(call_sid);
CREATE INDEX idx_call_events_created_at ON call_events(created_at DESC);
```

## Observability

### Structured Logging

All logs are in JSON format with correlation IDs:

```json
{
  "level": "info",
  "time": "2025-10-29T20:00:00.000Z",
  "service": "voice-agent",
  "pid": 12345,
  "msg": "twilio.session.started",
  "correlationId": "conn_1730234567890_abc123",
  "callSid": "CA1234567890abcdef",
  "from": "+1234567890",
  "to": "+0987654321",
  "direction": "inbound"
}
```

### Key Events

- `CALL_STARTED`: Call initiated
- `CALL_ENDED`: Call completed
- `TRANSCRIPT_USER`: User speech transcribed
- `TOOL_CALL`: MCP tool executed

### Metrics

Enable metrics collection with `METRICS_ENABLED=true`.

Key metrics:
- Call duration
- Transcription accuracy
- Tool execution latency
- WebSocket connection health
- Audio quality (MOS)

## Security

### Secrets Management

- Never commit secrets to version control
- Use `.env` files locally (git-ignored)
- Use environment variables in production
- Rotate credentials regularly

### Authentication

- Twilio webhook validation via `TWILIO_WEBHOOK_AUTH`
- Supabase service role key for backend operations
- OpenAI API key for Realtime access

### Compliance

- Mask PII in logs (phone numbers partially redacted)
- Store consent records for call recordings
- Follow GDPR/privacy regulations
- Implement call recording opt-in/opt-out

## Troubleshooting

### 400 Bad Request from Twilio

- Check that `PUBLIC_WS_URL` is correctly set
- Verify Cloudflare Tunnel is running
- Ensure TwiML is valid XML

### WebSocket Connection Failures

- Check firewall rules (ports 8787, 9797)
- Verify SSL/TLS certificates
- Check TWILIO_WEBHOOK_AUTH if enabled

### OpenAI Realtime Errors

- Verify API key has Realtime access
- Check rate limits
- Review model availability

### Audio Quality Issues

- Current implementation uses stub transcoding
- For production, implement proper DSP
- Monitor packet loss and jitter
- Adjust VAD thresholds

### Supabase Connection Issues

- Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
- Check network connectivity
- Review RLS policies (service role bypasses RLS)

## Testing

### Unit Tests

```bash
# Run unit tests
pnpm test

# Watch mode
pnpm test:watch
```

Tests cover:
- μ-law decoding
- Audio resampling
- MCP tool execution
- Session creation with retries

### Integration Tests

```bash
# Test with fake Twilio client
pnpm test:integration
```

### Manual Testing

1. Start the server: `pnpm dev`
2. Start Cloudflare Tunnel separately
3. Configure Twilio webhook
4. Call your Twilio number
5. Monitor logs

## Feature Flags

Control features incrementally:

- `VOICE_AGENT_ENABLED`: Enable/disable voice agent
- `MCP_ENABLED`: Enable/disable MCP tool server
- `DUPLEX_ENABLED`: Enable full-duplex audio (planned)
- `BARGE_IN_ENABLED`: Enable barge-in detection (planned)

## Rollout Plan

1. **Phase 1: Internal Testing**
   - Deploy behind `VOICE_AGENT_ENABLED=false`
   - Test with internal number
   - Monitor logs and metrics

2. **Phase 2: Limited Beta**
   - Enable for 10% of traffic
   - Collect feedback
   - Fix issues

3. **Phase 3: Full Rollout**
   - Enable for all traffic
   - Monitor performance
   - Iterate on features

## Known Limitations

### Current MVP

- **Transcoding**: Uses basic linear interpolation for resampling (stub)
- **Duplex**: Not yet fully implemented
- **Barge-in**: Planned for next phase
- **Load Testing**: Not yet performed at scale

### Planned Improvements

- Enhanced audio quality with proper DSP
- Full-duplex streaming
- Dynamic barge-in with interrupt detection
- Advanced backpressure control
- Multi-language support
- Custom prompts per line of business

## Support

For issues or questions:
- Check logs: `docker compose logs -f voice-agent`
- Review this documentation
- Check Supabase for persisted events
- Contact the EasyMO team

## License

Copyright © 2025 EasyMO. All rights reserved.
