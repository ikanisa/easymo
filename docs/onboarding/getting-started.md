# Getting Started Guide

Welcome to the EasyMO WhatsApp Webhook development team!

## Prerequisites

### Required Tools

| Tool         | Version | Installation                    |
| ------------ | ------- | ------------------------------- |
| Deno         | 1.38+   | https://deno.land/#installation |
| Supabase CLI | 1.100+  | `npm install -g supabase`       |
| Git          | 2.30+   | https://git-scm.com/downloads   |

### Recommended VS Code Extensions

- Deno (denoland.vscode-deno)
- YAML (redhat.vscode-yaml)
- GitLens (eamodio.gitlens)

## Project Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd easymo
```

### 2. Configure Deno

```bash
deno --version
deno cache supabase/functions/wa-webhook-core/index.ts
```

### 3. Set Up Supabase

```bash
supabase login
supabase link --project-ref lhbowpbcpwoiparwnwgt
supabase db pull
```

### 4. Configure Environment

Create a `.env` file:

```bash
SUPABASE_URL=https://lhbowpbcpwoiparwnwgt.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-key>
WHATSAPP_APP_SECRET=<your-secret>
WA_VERIFY_TOKEN=<your-token>
WA_PHONE_ID=<your-phone-id>
WA_TOKEN=<your-access-token>
```

### 5. Start Local Development

```bash
supabase start
supabase functions serve
```

## Project Structure

```
easymo/
├── supabase/
│   ├── functions/
│   │   ├── _shared/              # Shared modules
│   │   ├── wa-webhook-core/      # Core router
│   │   ├── wa-webhook-profile/   # Profile service
│   │   ├── wa-webhook-mobility/  # Mobility service
│   │   └── wa-webhook-insurance/ # Insurance service
│   └── migrations/               # Database migrations
├── docs/                         # Documentation
└── scripts/                      # Utility scripts
```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Follow coding standards:

- Use TypeScript strict mode
- Add JSDoc comments
- Follow existing patterns

### 3. Run Tests

```bash
./scripts/run-tests-with-coverage.sh
```

### 4. Type Check

```bash
deno check supabase/functions/wa-webhook-core/index.ts
```

### 5. Commit Changes

```bash
git add .
git commit -m "feat: add your feature description"
```

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `refactor:` Code refactoring
- `test:` Adding tests

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

## Testing Locally

### Using cURL

```bash
# Test health endpoint
curl http://localhost:54321/functions/v1/wa-webhook-core/health

# Test webhook verification
curl "http://localhost:54321/functions/v1/wa-webhook-core?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test"
```

## Common Tasks

### Adding a New Handler

1. Create handler file in appropriate service
2. Register in handler index
3. Add routing logic in router
4. Add tests

### Adding a New Shared Module

1. Create module in `_shared`
2. Export from module index
3. Import in services

## Getting Help

- **Documentation:** Check `/docs` folder
- **Slack:** #easymo-dev channel
- **Issues:** GitHub Issues

## Next Steps

1. [ ] Read the Architecture Overview
2. [ ] Review Coding Standards
3. [ ] Complete your first PR
4. [ ] Shadow an on-call rotation

_Welcome aboard! 🚀_
