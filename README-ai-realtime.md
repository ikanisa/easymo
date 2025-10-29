# OpenAI Realtime Integration - Quick Start Guide

This guide covers the new `services/ai-realtime` service that provides a single-socket OpenAI Realtime integration with event-based persona routing.

## What is This?

A standalone service that connects to OpenAI's Realtime API over a persistent WebSocket, supporting:

- **Hot-swappable AI personas** ("AI Waiter" ↔ "AI CFO")
- **Text-based interaction** with real-time responses
- **Pluggable tool handlers** integrated with Supabase
- **Structured observability** via pino logging

## Quick Start

### 1. Prerequisites

- OpenAI API key with Realtime API access
- Supabase project credentials
- Node.js 18+ and pnpm 10.18.3+

### 2. Setup

```bash
# Install dependencies (from repo root)
pnpm install --no-frozen-lockfile

# Build shared packages
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# Configure the service
cd services/ai-realtime
cp .env.example .env
# Edit .env and set your credentials
```

### 3. Run

```bash
# Development mode (with auto-reload)
pnpm --filter @easymo/ai-realtime dev

# Production mode
pnpm --filter @easymo/ai-realtime build
pnpm --filter @easymo/ai-realtime start
```

The service starts on port **7070** by default.

## API Endpoints

### POST /ai/say
Send text to the AI agent and receive a response.

```bash
curl -X POST http://localhost:7070/ai/say \
  -H 'Content-Type: application/json' \
  -d '{"text":"What drinks do you have?"}'
```

### POST /ai/persona
Switch between AI personas without reconnecting.

```bash
# Switch to CFO persona
curl -X POST http://localhost:7070/ai/persona \
  -H 'Content-Type: application/json' \
  -d '{"key":"cfo"}'

# Switch back to Waiter persona
curl -X POST http://localhost:7070/ai/persona \
  -H 'Content-Type: application/json' \
  -d '{"key":"waiter"}'
```

### GET /healthz
Health check endpoint.

```bash
curl http://localhost:7070/healthz
```

## Personas

### AI Waiter 🍽️
- **Context**: Bars/restaurants in Rwanda & Malta
- **Tone**: Friendly, concise, sales-oriented
- **Currencies**: RWF (Rwanda), EUR (Malta)
- **Tools**:
  - `lookup_menu` - Search menu items
  - `recommend_pairing` - Suggest upsells

### AI CFO 💼
- **Context**: Western markets (US/CA/EU/UK)
- **Expertise**: Accounting, tax, audit, IFRS/GAAP
- **Tools**:
  - `fetch_financials` - Retrieve GL lines/P&L
  - `check_tax_rule` - Query tax regulations

## Tool Handlers & Supabase Integration

Tool handlers query Supabase tables:

| Tool | Table | Purpose |
|------|-------|---------|
| `lookup_menu` | `menu_items` | Find items by name |
| `recommend_pairing` | `pairings` | Suggest upsells |
| `fetch_financials` | `gl_lines` | Financial data (stub) |
| `check_tax_rule` | `tax_rules` | Tax regulations (stub) |

**Note**: Financial tools are currently stubs. Update queries in `src/realtimeClient.ts` to match your schema.

## Testing

```bash
# Run unit tests
pnpm --filter @easymo/ai-realtime test

# Quick demos
pnpm --filter @easymo/ai-realtime ai:demo
pnpm --filter @easymo/ai-realtime ai:persona:cfo
```

## Docker

Build and run with Docker:

```bash
cd services/ai-realtime
docker build -t easymo-ai-realtime .
docker run -p 7070:7070 --env-file .env easymo-ai-realtime
```

## Environment Variables

Required:
- `OPENAI_API_KEY` - Your OpenAI API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key

Optional:
- `PORT` - Server port (default: 7070)
- `DEFAULT_PERSONA` - Starting persona (default: waiter)
- `LOG_LEVEL` - Logging level (default: info)

See `services/ai-realtime/.env.example` for complete configuration.

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP (POST /ai/say, /ai/persona)
       ▼
┌─────────────────┐
│  Express Server │
│  (server.ts)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       WebSocket        ┌──────────────────┐
│ RealtimeClient  │◄──────────────────────►│ OpenAI Realtime  │
│ (persistent WS) │                         │ API              │
└────────┬────────┘                         └──────────────────┘
         │
         ▼
┌─────────────────┐
│  Tool Handlers  │
│  (Supabase)     │
└─────────────────┘
```

## Observability

All logs are structured JSON via pino:
- WebSocket lifecycle events
- HTTP request/response timing
- Tool execution with args/results
- Persona switches

Configure `LOG_LEVEL` for verbosity (debug/info/warn/error).

## Security Notes

- Never log `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- Input validation with zod (1-5000 char limit)
- Consider adding auth middleware for production (e.g., API key header)
- Review tool handler queries for SQL injection risks

## Troubleshooting

**Build fails with "Cannot find module '@easymo/commons'"**
```bash
# Rebuild shared packages
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

**Connection to OpenAI fails**
- Verify API key is valid and has Realtime access
- Check network connectivity to api.openai.com
- Review logs for specific error messages

**Tool handlers return errors**
- Verify Supabase credentials
- Ensure referenced tables exist in your schema
- Check service role key has appropriate permissions

## What's Next?

Future enhancements:
- Audio modality support (switch from `text` to `audio`)
- Twilio Media Streams bridge integration
- WhatsApp voice call integration
- Router tool for agent-initiated persona handoffs
- OpenTelemetry tracing

## Documentation

Full documentation: `services/ai-realtime/README.md`

## Related Services

- `apps/api/src/modules/realtime` - Voice-focused Realtime module (Twilio/WhatsApp)
- `services/voice-bridge` - Voice bridge service
- `apps/voice-bridge` - Voice bridge application

This new `ai-realtime` service is **independent** and focuses on text-based persona routing.
