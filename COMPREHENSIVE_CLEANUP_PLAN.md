# Comprehensive Codebase Cleanup & Refactoring Plan

**Date**: 2025-11-14  
**Status**: 🔴 CRITICAL - Requires Immediate Action  
**Estimated Effort**: 5-7 days full-time

---

## 🔍 Executive Summary

**Current State**: Codebase has accumulated **132 markdown documentation files**, **30+ temporary scripts**, build artifacts, and unresolved technical debt that's blocking development and deployment.

**Key Issues Identified**:
1. ❌ Next.js 14.2.33 dev mode completely broken
2. ❌ 132 duplicate/outdated documentation files
3. ❌ 30+ temporary test/deployment scripts in root
4. ❌ Build artifacts committed to git (.next folders)
5. ❌ Missing dependencies causing build failures
6. ❌ Inconsistent package management (pnpm + npm mixed)
7. ❌ Security vulnerabilities (plain text passwords, no rate limiting)
8. ❌ No consistent error handling or logging
9. ❌ Hydration errors in production
10. ❌ No CI/CD pipeline validation

---

## 📊 Current Repository Analysis

### File Counts
- **Total JSON configs**: 390 files
- **Total TypeScript/JavaScript**: 2,122 files
- **Markdown documentation**: 132 files (EXCESSIVE)
- **Shell scripts**: 30+ temporary scripts
- **SQL files**: 8+ migration scripts in root

### Directory Structure Issues
```
easymo-/
├── 132+ .md files ❌ (Should be in docs/)
├── 30+ .sh scripts ❌ (Should be in scripts/)
├── 8+ .sql files ❌ (Should be in migrations/)
├── 2+ .log files ❌ (Should be gitignored)
├── .next/ folders ❌ (Should be gitignored)
└── Inconsistent structure across workspaces
```

### Workspace Structure
```
packages/
├── shared/ ✅
├── commons/ ✅
├── db/ ✅
├── messaging/ ✅
├── video-agent-schema/ ⚠️ (Missing dependencies)
└── ui/ ✅

services/ (12 microservices)
├── agent-core/ ✅
├── voice-bridge/ ✅
├── wallet-service/ ✅
└── ... 9 more

apps/
├── admin-app/ ❌ (Next.js 14.2.33 broken)
├── waiter-pwa/ ⚠️
├── real-estate-pwa/ ⚠️
└── ai/ ⚠️
```

---

## 🎯 Phase 1: Critical Infrastructure Fixes (Day 1-2)

### 1.1 Fix Next.js Development Mode ⚠️ URGENT

**Current Issue**: Next.js 14.2.33 dev mode completely broken due to Edge Runtime eval() bug

**Action Items**:
- [ ] Upgrade Next.js from 14.2.33 to 15.1.6
- [ ] Test all routes and middleware
- [ ] Verify Edge Runtime functions work
- [ ] Update TypeScript configs if needed
- [ ] Run full test suite

**Files to Update**:
```
admin-app/package.json
waiter-pwa/package.json (if applicable)
```

**Commands**:
```bash
cd admin-app
# Update package.json: "next": "15.1.6"
npm install
rm -rf .next
npm run build
npm run dev  # Verify it works
```

---

### 1.2 Fix Missing Dependencies

**Issues Found**:
- `@sinclair/typebox` missing from video-agent-schema
- Workspace protocol issues with npm vs pnpm

**Action Items**:
- [ ] Add missing dependencies to video-agent-schema
- [ ] Standardize on pnpm for all workspaces
- [ ] Remove npm usage from admin-app (convert to pnpm)
- [ ] Update all package.json files
- [ ] Run `pnpm install` and verify builds

**Files to Update**:
```
packages/video-agent-schema/package.json
admin-app/package.json (convert to pnpm)
```

---

### 1.3 Clean Build System

**Action Items**:
- [ ] Remove all .next directories
- [ ] Remove all dist/ directories
- [ ] Add proper .gitignore rules
- [ ] Setup consistent build order
- [ ] Create build:all script that works

**Create**: `.gitignore` additions
```gitignore
# Build outputs
.next/
dist/
build/
*.log
*.tsbuildinfo

# Temporary files
*.sql.backup
*.md.backup
combined_*.sql

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
```

---

## 🗂️ Phase 2: Repository Organization (Day 2-3)

### 2.1 Documentation Consolidation

**Current**: 132 markdown files scattered in root  
**Target**: Organized documentation structure

**Action Plan**:

```bash
# Create new structure
mkdir -p docs/{
  architecture,
  deployment,
  development,
  features,
  archive
}

# Move and organize files:
docs/
├── README.md (main)
├── CONTRIBUTING.md
├── architecture/
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   └── API_DESIGN.md
├── deployment/
│   ├── DEPLOYMENT_GUIDE.md
│   ├── PRODUCTION_CHECKLIST.md
│   └── ENVIRONMENT_SETUP.md
├── development/
│   ├── DEV_SETUP.md
│   ├── CODING_STANDARDS.md
│   └── TESTING_GUIDE.md
├── features/
│   ├── WAITER_AI.md
│   ├── MARKETPLACE.md
│   └── AUTHENTICATION.md
└── archive/
    └── (Move outdated docs here)
```

**Decision Matrix for Each File**:
| Keep | Archive | Delete |
|------|---------|--------|
| Current features | Old summaries | Duplicates |
| Setup guides | Superseded versions | Temp notes |
| Architecture | Implementation logs | Build logs |

**Files to Review and Consolidate** (Partial List):
```
AI_AGENT_*.md (30+ files) → Consolidate to docs/features/AI_AGENTS.md
WAITER_AI_*.md (15+ files) → Consolidate to docs/features/WAITER_AI.md
DEPLOYMENT_*.md (10+ files) → Consolidate to docs/deployment/
WA_WEBHOOK_*.md (8+ files) → Consolidate to docs/features/WA_WEBHOOK.md
```

---

### 2.2 Script Organization

**Current**: 30+ scripts in root  
**Target**: Organized scripts/ directory

```bash
scripts/
├── development/
│   ├── dev-setup.sh
│   ├── seed-data.sh
│   └── test-env.sh
├── deployment/
│   ├── deploy-production.sh
│   ├── deploy-staging.sh
│   └── rollback.sh
├── database/
│   ├── migrate.sh
│   ├── backup.sh
│   └── restore.sh
├── testing/
│   ├── run-tests.sh
│   ├── e2e-tests.sh
│   └── integration-tests.sh
└── utilities/
    ├── check-health.sh
    ├── cleanup.sh
    └── verify-env.sh
```

**Action Items**:
- [ ] Move all .sh files to scripts/
- [ ] Categorize by purpose
- [ ] Add README.md in scripts/ explaining each
- [ ] Make all scripts executable
- [ ] Add proper error handling
- [ ] Document required environment variables

---

### 2.3 Migration Files Organization

**Current**: SQL files scattered in root  
**Target**: Proper migrations structure

```bash
migrations/
├── manual/
│   ├── APPLY_THIS_SQL.sql
│   ├── combined_cleanup_migration.sql
│   └── README.md (explain manual migrations)
├── archive/
│   └── (Old/completed migrations)
└── README.md (migration strategy)
```

**Action Items**:
- [ ] Move all .sql files to migrations/
- [ ] Document which have been applied
- [ ] Create rollback procedures
- [ ] Add migration status tracking

---

## 🔒 Phase 3: Security Hardening (Day 3-4)

### 3.1 Authentication Security

**Critical Issues from LOGIN_INTERFACE_REVIEW.md**:

1. **Plain Text Passwords** ❌ CRITICAL
2. **No Rate Limiting** ❌ CRITICAL
3. **Timing Attacks** ❌ CRITICAL
4. **No CSRF Protection** ❌ HIGH
5. **Console Logs in Production** ⚠️ MEDIUM

**Implementation Plan**:

#### 3.1.1 Password Hashing
```bash
cd admin-app
npm install bcrypt @types/bcrypt
```

**Update**: `lib/server/admin-credentials.ts`
```typescript
import bcrypt from 'bcrypt';

// Store hashed passwords in env (need to hash existing ones)
export async function verifyAdminCredential(
  email: string, 
  password: string
): Promise<AdminCredentialRecord | null> {
  const credential = findAdminCredentialByEmail(email);
  
  // Timing-safe comparison (always hash even if user doesn't exist)
  const dummyHash = '$2b$10$DUMMY_HASH_FOR_TIMING_SAFETY';
  const hashToCompare = credential?.passwordHash ?? dummyHash;
  
  const isValid = await bcrypt.compare(password, hashToCompare);
  
  if (!credential || !isValid) {
    return null;
  }
  
  authorizeActor(credential.actorId);
  return credential;
}
```

#### 3.1.2 Rate Limiting
**Install**:
```bash
npm install express-rate-limit
```

**Create**: `lib/server/rate-limit.ts`
```typescript
import { LRUCache } from 'lru-cache';

const rateLimitStore = new LRUCache<string, { count: number; resetAt: number }>({
  max: 500,
  ttl: 15 * 60 * 1000, // 15 minutes
});

export function checkRateLimit(identifier: string, maxAttempts = 5): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + 15 * 60 * 1000 };
  }
  
  if (entry.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  
  entry.count++;
  rateLimitStore.set(identifier, entry);
  return { allowed: true, remaining: maxAttempts - entry.count, resetAt: entry.resetAt };
}
```

#### 3.1.3 CSRF Protection
**Create**: `lib/server/csrf.ts`
```typescript
import { createHmac, randomBytes } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || 'change-me-in-production';

export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('base64url');
  const signature = createHmac('sha256', CSRF_SECRET).update(token).digest('base64url');
  return `${token}.${signature}`;
}

export function validateCsrfToken(token: string | null): boolean {
  if (!token) return false;
  
  const [tokenPart, signature] = token.split('.');
  if (!tokenPart || !signature) return false;
  
  const expectedSignature = createHmac('sha256', CSRF_SECRET)
    .update(tokenPart)
    .digest('base64url');
  
  return signature === expectedSignature;
}
```

---

### 3.2 Environment Variables Audit

**Create**: `scripts/utilities/audit-env.sh`
```bash
#!/bin/bash
# Audit environment variables for security issues

echo "🔍 Auditing environment variables..."

# Check for common issues
if grep -r "VITE_.*SERVICE_ROLE" .env* 2>/dev/null; then
  echo "❌ CRITICAL: Service role key in client-side variable!"
  exit 1
fi

if grep -r "NEXT_PUBLIC_.*SECRET" .env* 2>/dev/null; then
  echo "❌ CRITICAL: Secret in public variable!"
  exit 1
fi

if grep -r "password.*:" admin-app/.env* 2>/dev/null | grep -v "#"; then
  echo "⚠️  WARNING: Plain text passwords found in .env files"
fi

echo "✅ Environment audit complete"
```

---

## 🏗️ Phase 4: Code Standardization (Day 4-5)

### 4.1 TypeScript Configuration

**Standardize** all tsconfig.json files:

**Root** `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "incremental": true
  }
}
```

**Action Items**:
- [ ] Create tsconfig.base.json
- [ ] Update all workspace tsconfigs to extend base
- [ ] Fix all TypeScript errors
- [ ] Enable strict mode everywhere
- [ ] Run `pnpm type-check` across all workspaces

---

### 4.2 ESLint Configuration

**Standardize** linting rules:

**Root** `eslint.config.js`:
```javascript
import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': typescript,
      'react': react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      
      // React
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      
      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
];
```

**Action Items**:
- [ ] Apply consistent linting across all workspaces
- [ ] Fix all linting errors
- [ ] Setup pre-commit hooks
- [ ] Add lint:fix to all packages

---

### 4.3 Error Handling Standardization

**Create**: `packages/commons/src/errors.ts`
```typescript
export class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends ApplicationError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends ApplicationError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends ApplicationError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, { retryAfter });
  }
}
```

**Action Items**:
- [ ] Replace all ad-hoc error handling with standardized errors
- [ ] Add error boundaries in React apps
- [ ] Implement global error handler in API routes
- [ ] Log all errors with correlation IDs

---

### 4.4 Logging Standardization

**Create**: `packages/commons/src/logger.ts`
```typescript
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    },
  } : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    env: process.env.NODE_ENV,
  },
});

export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// Sanitize sensitive data before logging
export function sanitize(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized = { ...data as Record<string, unknown> };
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization'];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
```

**Action Items**:
- [ ] Replace all console.log with logger
- [ ] Add structured logging everywhere
- [ ] Remove sensitive data from logs
- [ ] Add correlation ID tracking

---

## 🧪 Phase 5: Testing Infrastructure (Day 5-6)

### 5.1 Test Organization

**Current State**: Tests scattered, inconsistent

**Target Structure**:
```
admin-app/
├── __tests__/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── tests/
│   └── auth-flow.test.ts (existing)
└── vitest.config.ts

services/*/
├── test/
│   ├── unit/
│   └── integration/
└── jest.config.js (or vitest.config.ts)
```

**Action Items**:
- [ ] Standardize test framework (prefer Vitest)
- [ ] Create test utilities package
- [ ] Add test coverage requirements (80%+)
- [ ] Setup test database for integration tests
- [ ] Add E2E tests for critical flows

---

### 5.2 CI/CD Pipeline

**Create**: `.github/workflows/main.yml`
```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10.18.3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10.18.3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm type-check
      
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10.18.3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10.18.3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - uses: actions/upload-artifact@v3
        with:
          name: build-artifacts
          path: |
            admin-app/.next
            packages/*/dist
```

---

## 📦 Phase 6: Dependency Management (Day 6)

### 6.1 Dependency Audit

**Run**:
```bash
# Check for outdated packages
pnpm outdated -r

# Check for security vulnerabilities
pnpm audit

# Check for unused dependencies
npx depcheck
```

**Action Items**:
- [ ] Update all dependencies to latest stable
- [ ] Remove unused dependencies
- [ ] Fix security vulnerabilities
- [ ] Deduplicate dependencies
- [ ] Lock versions for critical packages

---

### 6.2 Package.json Cleanup

**For each package**:
- [ ] Remove unused dependencies
- [ ] Add missing peer dependencies
- [ ] Standardize version ranges (use ^)
- [ ] Add proper scripts
- [ ] Add engines field

**Template**:
```json
{
  "name": "@easymo/package-name",
  "version": "0.1.0",
  "private": true,
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=10.18.0"
  },
  "scripts": {
    "dev": "...",
    "build": "...",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "type-check": "tsc --noEmit"
  }
}
```

---

## 🚀 Phase 7: Deployment Preparation (Day 7)

### 7.1 Environment Setup

**Create**: `.env.example` (comprehensive)
```bash
# ============================================
# EasyMO Environment Configuration
# ============================================

# Node Environment
NODE_ENV=development

# ============================================
# Supabase Configuration
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-only (DO NOT prefix with NEXT_PUBLIC_)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ============================================
# Authentication
# ============================================
ADMIN_SESSION_SECRET=minimum-32-characters-required-here
CSRF_SECRET=another-32-characters-required-here

# Admin Credentials (use hashed passwords in production)
ADMIN_ACCESS_CREDENTIALS=[{"actorId":"uuid","email":"admin@example.com","passwordHash":"$2b$10$..."}]

# ============================================
# Database
# ============================================
DATABASE_URL=postgresql://user:password@host:5432/database

# ============================================
# External Services
# ============================================
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
WHATSAPP_PHONE_NUMBER=+...

# ============================================
# Feature Flags
# ============================================
FEATURE_MARKETPLACE=false
FEATURE_VIDEO_AGENT=false
FEATURE_AI_WAITER=false

# ============================================
# Microservices URLs (Development)
# ============================================
NEXT_PUBLIC_AGENT_CORE_URL=http://localhost:3001
NEXT_PUBLIC_VOICE_BRIDGE_API_URL=http://localhost:3002
NEXT_PUBLIC_WALLET_SERVICE_URL=http://localhost:3006
```

**Action Items**:
- [ ] Document all required environment variables
- [ ] Create .env.example for each environment
- [ ] Setup secrets management (Vault/AWS Secrets Manager)
- [ ] Remove hardcoded values
- [ ] Add validation script

---

### 7.2 Docker Setup

**Create**: `docker-compose.yml`
```yaml
version: '3.8'

services:
  admin-app:
    build:
      context: .
      dockerfile: admin-app/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: easymo
      POSTGRES_USER: easymo
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

---

### 7.3 Deployment Checklist

**Create**: `DEPLOYMENT_CHECKLIST.md`
```markdown
# Production Deployment Checklist

## Pre-Deployment
- [ ] All tests passing
- [ ] No linting errors
- [ ] TypeScript compilation successful
- [ ] Security audit passed
- [ ] Dependencies up to date
- [ ] Environment variables configured
- [ ] Database migrations reviewed
- [ ] Backup created

## Security
- [ ] Passwords hashed (bcrypt)
- [ ] Rate limiting enabled
- [ ] CSRF protection active
- [ ] Security headers set
- [ ] HTTPS enforced
- [ ] API keys in secrets manager
- [ ] No sensitive data in logs
- [ ] Input validation everywhere

## Performance
- [ ] Build optimized
- [ ] Images optimized
- [ ] Caching configured
- [ ] CDN setup
- [ ] Database indexed
- [ ] Connection pooling enabled

## Monitoring
- [ ] Error tracking setup (Sentry)
- [ ] Logging configured
- [ ] Metrics collection enabled
- [ ] Alerts configured
- [ ] Health checks working

## Documentation
- [ ] API documentation updated
- [ ] Deployment guide updated
- [ ] Runbooks created
- [ ] Team trained

## Post-Deployment
- [ ] Smoke tests passed
- [ ] Critical flows verified
- [ ] Monitoring active
- [ ] Team notified
- [ ] Rollback plan ready
```

---

## 📋 Cleanup Execution Order

### Week 1: Foundation
1. **Day 1**: Phase 1 - Infrastructure fixes (Next.js, deps, builds)
2. **Day 2**: Phase 2 - Repository organization (docs, scripts, files)
3. **Day 3**: Phase 3 - Security hardening (auth, rate limiting, CSRF)
4. **Day 4**: Phase 4 - Code standardization (TS, ESLint, errors, logging)
5. **Day 5**: Phase 5 - Testing infrastructure (tests, CI/CD)
6. **Day 6**: Phase 6 - Dependency management (audit, update, cleanup)
7. **Day 7**: Phase 7 - Deployment prep (env, Docker, checklist)

### Week 2: Verification & Deployment
1. **Day 8**: Full system testing
2. **Day 9**: Performance optimization
3. **Day 10**: Documentation review
4. **Day 11**: Security audit
5. **Day 12**: Staging deployment
6. **Day 13**: Production dry-run
7. **Day 14**: Production deployment

---

## ✅ Success Criteria

### Code Quality
- [ ] 0 TypeScript errors
- [ ] 0 ESLint errors
- [ ] 80%+ test coverage
- [ ] All tests passing
- [ ] Build time < 5 minutes

### Security
- [ ] All critical security issues resolved
- [ ] No plain text passwords
- [ ] Rate limiting on all auth endpoints
- [ ] CSRF protection enabled
- [ ] Security headers configured

### Organization
- [ ] < 20 markdown files in root
- [ ] 0 build artifacts in git
- [ ] All scripts in scripts/
- [ ] All migrations in migrations/
- [ ] Clean git history

### Performance
- [ ] Login page loads < 2s
- [ ] API response time < 200ms (p95)
- [ ] No memory leaks
- [ ] Proper caching
- [ ] Optimized builds

### Documentation
- [ ] Clear README
- [ ] Complete setup guide
- [ ] API documentation
- [ ] Architecture diagrams
- [ ] Deployment procedures

---

## 🚨 Risk Mitigation

### Backup Strategy
1. Create full backup before starting
2. Tag current state: `git tag pre-cleanup-backup`
3. Keep copy of current .env files
4. Export current database
5. Document rollback procedure

### Rollback Plan
```bash
# If things go wrong:
git reset --hard pre-cleanup-backup
git clean -fd
pnpm install --frozen-lockfile
# Restore database backup
# Restore .env files
```

---

## 📞 Support & Resources

**Team Availability**:
- Lead Developer: Available for critical decisions
- DevOps: Available for deployment issues
- QA: Available for testing verification

**External Resources**:
- Next.js 15 Migration Guide
- pnpm Workspace Documentation
- OWASP Security Checklist
- Docker Best Practices

---

## Next Steps

1. **Review this plan** with the team
2. **Get approval** for breaking changes
3. **Schedule cleanup window** (2 weeks)
4. **Create backup** of current state
5. **Begin Phase 1** (Infrastructure fixes)

**Estimated Total Effort**: 10-14 days
**Recommended Team**: 2-3 developers
**Risk Level**: Medium (with proper backup/rollback)
**Business Impact**: High (enables future development)

---

**Last Updated**: 2025-11-14  
**Status**: Awaiting Approval  
**Priority**: CRITICAL
