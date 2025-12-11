# 🚀 EasyMO Developer Onboarding Guide

**Welcome to EasyMO!**  
**Last Updated**: 2025-11-27  
**Reading Time**: 15 minutes

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Setup Steps](#setup-steps)
4. [Development Workflow](#development-workflow)
5. [Common Tasks](#common-tasks)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [Getting Help](#getting-help)

---

## Quick Start

Get up and running in under 10 minutes:

```bash
# 1. Clone the repository
git clone https://github.com/ikanisa/easymo-.git
cd easymo-

# 2. Install dependencies
pnpm install --frozen-lockfile

# 3. Build shared packages (IMPORTANT!)
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# 4. Copy environment file
cp .env.example .env.local

# 5. Start development server
pnpm dev
```

**That's it!** You should now have the app running at `http://localhost:8080`

---

## Prerequisites

### Required Software

1. **Node.js** 20.x or higher

   ```bash
   node --version  # Should be v20.x.x
   ```

2. **pnpm** 10.18.3 or higher (NOT npm!)

   ```bash
   npm install -g pnpm@10.18.3
   pnpm --version
   ```

3. **Git** 2.x or higher

   ```bash
   git --version
   ```

4. **Docker** (for local Supabase and services)
   ```bash
   docker --version
   ```

### Recommended Tools

- **VS Code** with extensions:
  - ESLint
  - Prettier
  - TypeScript
  - Tailwind CSS IntelliSense
- **Supabase CLI**
  ```bash
  brew install supabase/tap/supabase
  ```

---

## Setup Steps

### 1. Clone and Install

```bash
git clone https://github.com/ikanisa/easymo-.git
cd easymo-

# Use pnpm (IMPORTANT: NOT npm!)
pnpm install --frozen-lockfile
```

**Why pnpm?** The workspace uses `workspace:*` protocol that npm doesn't support properly.

### 2. Build Shared Packages First

**CRITICAL**: Always build shared packages before running services!

```bash
# Build in order
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# Or build all packages
pnpm build:packages
```

**Why?** Services depend on compiled packages. Without this step, TypeScript and ESLint will fail.

### 3. Environment Configuration

```bash
# Copy example file
cp .env.example .env.local

# Edit with your values
code .env.local  # or vim, nano, etc.
```

**Required Variables**:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Providers (at least one)
OPENAI_API_KEY=sk-...
GOOGLE_AI_API_KEY=AI...

# Database
DATABASE_URL=postgresql://...
```

**Security Note**: Never commit `.env.local` or put secrets in `VITE_*` or `NEXT_PUBLIC_*` vars!

### 4. Start Supabase (Local)

```bash
# Start local Supabase
supabase start

# Apply migrations
supabase db push

# Seed data (optional)
pnpm seed:local
```

### 5. Start Development Server

```bash
# Main app (Vite)
pnpm dev

# Admin app (Next.js)
cd admin-app && npm run dev

# Specific service
pnpm --filter @easymo/agent-core start:dev
```

---

## Development Workflow

### Daily Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
pnpm install

# 3. Rebuild shared packages if updated
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build

# 4. Start dev server
pnpm dev
```

### Making Changes

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make your changes

# 3. Run linter (auto-fixes many issues)
pnpm lint --fix

# 4. Run type check
pnpm type-check

# 5. Run tests
pnpm test

# 6. Commit (pre-commit hook runs automatically)
git add .
git commit -m "feat: your feature description"

# 7. Push and create PR
git push origin feature/your-feature-name
```

### Pre-commit Hooks

Pre-commit hooks automatically run on every commit:

- ✅ ESLint checking
- ✅ TypeScript type checking

If hooks fail, fix the errors before committing.

---

## Common Tasks

### Running Tests

```bash
# All tests
pnpm test

# Specific package
pnpm --filter @easymo/wallet-service test

# Watch mode
pnpm test -- --watch

# With coverage
pnpm test -- --coverage
```

### Linting and Formatting

```bash
# Lint all files
pnpm lint

# Lint with auto-fix
pnpm lint --fix

# Type check
pnpm type-check

# Format with Prettier (if configured)
pnpm format
```

### Building

```bash
# Build everything
pnpm build

# Build specific package
pnpm --filter @easymo/commons build

# Build for production
pnpm build:prod
```

### Working with Supabase

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Apply migrations
supabase db push

# Create new migration
supabase migration new your_migration_name

# Reset database
supabase db reset

# View logs
supabase logs
```

### Working with Services

```bash
# Start all services (Docker)
docker-compose up -d

# Start specific service
pnpm --filter @easymo/agent-core start:dev

# View service logs
docker-compose logs -f agent-core

# Stop all services
docker-compose down
```

---

## Project Structure

```
easymo-/
├── packages/              # Shared libraries
│   ├── commons/          # Logging, utils, auth
│   ├── db/               # Prisma client
│   ├── agents/           # AI agents
│   └── media-utils/      # Audio/video utils
├── services/              # Microservices
│   ├── agent-core/       # Main AI service
│   ├── wallet-service/   # Payments
│   └── profile/          # User profiles
├── admin-app/             # Admin dashboard (Next.js)
├── waiter-pwa/            # Waiter app (PWA)
├── client-pwa/            # Customer app (PWA)
├── supabase/
│   ├── functions/        # Edge functions
│   └── migrations/       # SQL migrations
├── scripts/               # Automation scripts
│   ├── audit/            # Compliance checks
│   ├── codemod/          # Code transformations
│   ├── maintenance/      # Maintenance tasks
│   └── verify/           # Verification scripts
└── docs/                  # Documentation
```

---

## Troubleshooting

### "Cannot find module '@easymo/commons'"

**Solution**: Build shared packages first

```bash
pnpm --filter @va/shared build
pnpm --filter @easymo/commons build
```

### "SECURITY VIOLATION in .env"

**Problem**: Server secrets in client-side environment variables

**Solution**: Remove `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_TOKEN`, etc. from `VITE_*` or
`NEXT_PUBLIC_*` variables. These should only be in server-side env vars.

### ESLint Errors on Commit

**Solution**: Fix the errors or run:

```bash
pnpm lint --fix
```

### TypeScript Errors

**Solution**:

1. Rebuild shared packages
2. Restart TypeScript server in VS Code
3. Check `tsconfig.json` paths

### Port Already in Use

**Solution**:

```bash
# Find process using port
lsof -i :8080

# Kill process
kill -9 <PID>
```

### Supabase Connection Issues

**Solution**:

```bash
# Restart Supabase
supabase stop
supabase start

# Check status
supabase status
```

---

## Best Practices

### Code Quality

1. **Always use structured logging** (no `console.log`)

   ```typescript
   import { childLogger } from "@easymo/commons";
   const log = childLogger({ service: "my-service" });

   log.info({ userId, action }, "User action performed");
   ```

2. **Use TypeScript strictly** (no `any` types)

   ```typescript
   // Bad
   function process(data: any) {}

   // Good
   interface UserData {
     id: string;
     name: string;
   }
   function process(data: UserData) {}
   ```

3. **Write tests for new features**

   ```typescript
   import { describe, it, expect } from "vitest";

   describe("MyFeature", () => {
     it("should work correctly", () => {
       expect(myFunction()).toBe(expected);
     });
   });
   ```

### Git Workflow

1. **Write clear commit messages**

   ```bash
   # Good
   git commit -m "feat: add user profile API endpoint"
   git commit -m "fix: resolve wallet balance calculation error"

   # Bad
   git commit -m "updates"
   git commit -m "fix stuff"
   ```

2. **Keep PRs small and focused**
   - One feature per PR
   - Include tests
   - Update documentation

3. **Pull latest before starting work**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/my-feature
   ```

### Performance

1. **Build shared packages only when changed**
2. **Use `pnpm --filter` for targeted builds**
3. **Keep dependencies up to date**
4. **Use caching in CI/CD**

---

## Getting Help

### Documentation

- **Architecture**: `docs/ARCHITECTURE.md`
- **API Reference**: `docs/API_DOCUMENTATION.md`
- **Ground Rules**: `docs/GROUND_RULES.md`
- **Quick Start**: `REFACTORING_QUICKSTART.md`

### Running Scripts

```bash
# Check observability compliance
node scripts/audit/observability-compliance.mjs

# Verify workspace dependencies
bash scripts/verify/workspace-deps.sh

# Security audit
bash scripts/security/audit-env-files.sh
```

### Ask the Team

- **Slack**: #easymo-dev channel
- **GitHub Issues**: For bugs and feature requests
- **Code Review**: Tag @frontend-team or @backend-team in PRs

### Useful Commands Reference

```bash
# Package management
pnpm install --frozen-lockfile     # Install dependencies
pnpm add <package>                  # Add dependency
pnpm add -D <package>               # Add dev dependency
pnpm --filter <pkg> add <dep>      # Add to specific package

# Development
pnpm dev                            # Start dev server
pnpm build                          # Build all
pnpm test                           # Run tests
pnpm lint                           # Lint code
pnpm type-check                     # Type check

# Database
supabase start                      # Start local Supabase
supabase db push                    # Apply migrations
supabase migration new <name>      # New migration
pnpm seed:local                     # Seed data

# Services
docker-compose up -d                # Start services
docker-compose down                 # Stop services
docker-compose logs -f <service>   # View logs
```

---

## Next Steps

After completing onboarding:

1. ✅ Read `docs/GROUND_RULES.md` (MANDATORY)
2. ✅ Review `docs/ARCHITECTURE.md`
3. ✅ Browse `docs/API_DOCUMENTATION.md`
4. ✅ Pick your first issue from GitHub
5. ✅ Join the #easymo-dev Slack channel

---

## Welcome Aboard! 🚀

You're now ready to contribute to EasyMO. Remember:

- Build shared packages first
- Use pnpm (not npm)
- Follow ground rules
- Write tests
- Ask questions

**Happy coding!** 💻

---

**Questions?** Reach out to the team lead or post in #easymo-dev

**Found an issue with this guide?** Submit a PR to improve it!
