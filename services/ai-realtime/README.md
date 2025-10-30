# AI Realtime Service

Single-socket OpenAI Realtime integration with event-based persona routing ("AI Waiter" ↔ "AI CFO"). Built for WhatsApp/Twilio voice bridges or chat backends.

## Overview

This service exposes REST endpoints that communicate with OpenAI's Realtime API over a persistent WebSocket connection. It supports:

- **Hot-swappable personas** (AI Waiter, AI CFO) without reconnecting
- **Pluggable tool handlers** with Supabase integration
- **Structured logging** via pino
- **Text-based interaction** (audio modality can be added later)

## Quick Start

### 1. Install Dependencies

From the monorepo root:

```bash
pnpm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cd services/ai-realtime
cp .env.example .env
```

Edit `.env` and set:

- `OPENAI_API_KEY` - Your OpenAI API key with Realtime access
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

### 3. Run the Service

```bash
# Development mode with auto-reload
pnpm dev

# OR production mode
pnpm build
pnpm start
```

The service will start on port `7070` (configurable via `PORT` env var).

## API Endpoints

### POST /ai/say

Send text to the AI agent.

**Request:**
```bash
curl -X POST http://localhost:7070/ai/say \
  -H 'Content-Type: application/json' \
  -d '{"text":"What drinks do you have?"}'
```

**Response:**
```json
{"ok": true}
```

The AI's response will be streamed to stdout.

### POST /ai/persona

Switch the active persona (hot-swap system prompt and tools).

**Request:**
```bash
curl -X POST http://localhost:7070/ai/persona \
  -H 'Content-Type: application/json' \
  -d '{"key":"cfo"}'
```

**Response:**
```json
{"ok": true, "active": "cfo"}
```

Valid keys: `waiter`, `cfo`

### GET /healthz

Health check endpoint.

**Request:**
```bash
curl http://localhost:7070/healthz
```

**Response:**
```json
{
  "ok": true,
  "persona": "waiter",
  "service": "ai-realtime"
}
```

## Personas

### AI Waiter

**System Prompt:**
> You are AI Waiter for bars/restaurants in Rwanda & Malta. Tone: friendly, concise, sales-oriented upsells. Use RWF in Rwanda, EUR in Malta. Ask one clarifying question if uncertain.

**Tools:**
- `lookup_menu` - Find menu items by name
- `recommend_pairing` - Suggest upsell pairings

### AI CFO

**System Prompt:**
> You are AI CFO for Western markets (US/CA/EU/UK). Expert in accounting, tax, audit, controls, IFRS/GAAP. Cite the exact standard/authority in your reasoning summary.

**Tools:**
- `fetch_financials` - Retrieve GL lines or P&L summary
- `check_tax_rule` - Check tax rules by jurisdiction

## Tool Handlers

Tool handlers are implemented in `src/realtimeClient.ts` and integrate with Supabase tables:

- `lookup_menu` → queries `menu_items` table
- `recommend_pairing` → queries `pairings` table
- `fetch_financials` → queries `gl_lines` table (stub implementation)
- `check_tax_rule` → queries `tax_rules` table (stub implementation)

**Note:** Financial tools (CFO persona) are currently stubs. Update the queries in `realtimeClient.ts` to match your actual schema.

## Demo Scripts

Quick test scripts are available in `package.json`:

```bash
# Switch to CFO persona
pnpm ai:persona:cfo

# Send a test message
pnpm ai:demo
```

## Architecture

```
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

- WebSocket lifecycle (open/error/close)
- HTTP requests (method, path, status, duration)
- Tool execution (name, args, output)
- Persona switches

Configure `LOG_LEVEL` (debug, info, warn, error) in `.env`.

## Security

- Never log `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- Input validation with zod (text length: 1-5000 chars)
- Consider adding auth middleware for production use (e.g., API key header)

## Future Enhancements

- Audio modality (switch from `text` to `audio`)
- Twilio Media Streams bridge
- WhatsApp voice integration
- Router tool for agent-initiated persona handoffs
- OpenTelemetry tracing

## Troubleshooting

**Connection fails:**
- Verify `OPENAI_API_KEY` is valid and has Realtime access
- Check network connectivity to `api.openai.com`

**Tool handlers fail:**
- Verify Supabase credentials are correct
- Check that referenced tables exist in your schema
- Review logs for specific error messages

**Persona switch doesn't work:**
- Ensure valid persona key (`waiter` or `cfo`)
- Check logs for persona switch confirmation

## Development

```bash
# Run tests
pnpm test

# Build
pnpm build

# Type check
tsc --noEmit
```

## License

Private - EasyMO
