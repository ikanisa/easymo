# EasyMo

> WhatsApp-first platform for Rwanda market

## What is EasyMo?

EasyMo provides essential services through WhatsApp:
- Mobility - Ride booking and scheduling
- Buy & Sell - AI-powered marketplace
- Insurance - Quote management
- Wallets - Mobile money integration

Supported: Rwanda (RW) only | Currency: RWF | Languages: English, French

## Quick Start

```bash
# 1. Clone repository
git clone https://github.com/ikanisa/easymo.git
cd easymo

# 2. Copy environment file
cp .env.example .env

# 3. Install dependencies
pnpm install

# 4. Start Supabase
supabase start

# 5. Run migrations
supabase db reset

# 6. Start development server
pnpm dev
```

Full setup guide: docs/setup/local-development.md

## Documentation

- Setup Guide: docs/setup/local-development.md
- Architecture: docs/architecture/system-overview.md
- Deployment: docs/deployment/cloud-run.md
- Contributing: CONTRIBUTING.md
- Changelog: CHANGELOG.md

## Technology Stack

- Frontend: Next.js 15, React, TailwindCSS
- Backend: Node.js, Supabase Edge Functions
- Database: PostgreSQL (Supabase)
- Messaging: WhatsApp Cloud Business API
- AI: OpenAI GPT-5, Google Gemini-3
- Infrastructure: Google Cloud Run, Netlify

## Services Architecture

```
+-------------------------------+
|     Admin Panel (Next.js)     |
+-------------------------------+
               |
   +-----------+-----------+
   |           |           |
   v           v           v
+-----------+ +-----------+ +--------------+
| Agent Core| | Voice     | | Wallet       |
|           | | Bridge    | | Service      |
+-----------+ +-----------+ +--------------+
   |           |           |
   +-----------+-----------+
               v
        +--------------+
        |   Supabase   |
        | (PostgreSQL) |
        +--------------+
```

Detailed architecture: docs/architecture/system-overview.md

## Development

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build

# Deploy edge functions
pnpm functions:deploy
```

## Environment Variables

Required:
- NEXT_PUBLIC_SUPABASE_URL - Supabase project URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY - Supabase anon key
- SUPABASE_SERVICE_ROLE_KEY - Service role key (server-only)
- EASYMO_ADMIN_TOKEN - Admin API token
- ADMIN_SESSION_SECRET - Session secret (32+ chars)

Full configuration: docs/setup/environment-variables.md

## Critical Rules

NEVER:
- Use Twilio (use WhatsApp Cloud API directly)
- Use MoMo API (use USSD mobile money)
- Translate UI to Kinyarwanda (rw)
- Support countries other than RW

See CONTRIBUTING.md for complete guidelines.

## Support

- Issues: https://github.com/ikanisa/easymo/issues
- Discussions: https://github.com/ikanisa/easymo/discussions
- Documentation: docs/

## License

License file not yet added.

Live: https://easymo.vercel.app
