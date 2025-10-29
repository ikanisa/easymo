# Voice Agent

Production-ready voice agent connecting Twilio Media Streams to OpenAI Realtime API with MCP tool support.

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run in development
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test
```

## Docker

```bash
# Start with Docker Compose (includes Cloudflare Tunnel)
docker compose up --build

# The tunnel will print the public URL in logs
docker compose logs cloudflared | grep "trycloudflare.com"
```

## Features

- ✅ Twilio Media Streams → OpenAI Realtime
- ✅ MCP tool server with Supabase integration
- ✅ Structured logging with correlation IDs
- ✅ Feature flags for incremental rollout
- ✅ Docker + Cloudflare Tunnel support
- ✅ Health and readiness checks

## Documentation

See [docs/voice-agent.md](../../docs/voice-agent.md) for comprehensive documentation including:
- Architecture overview
- Twilio configuration
- MCP tool usage
- Database schema
- Troubleshooting guide

## Requirements

- Node.js 20+
- pnpm 10.18.3+
- OpenAI API key with Realtime access
- Twilio account with Media Streams
- Supabase project
- Cloudflare Tunnel token (optional, for public exposure)

## Environment Variables

See `.env.example` for all available configuration options.

Required:
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PUBLIC_WS_URL`

## License

Copyright © 2025 EasyMO
