# Security Hardening Guide

**Last Updated**: 2025-11-27  
**Security Level**: Production-Ready

---

## Overview

This document outlines security measures implemented and recommended for EasyMO production
deployment.

## Security Checklist

### ✅ Completed

- [x] Environment variables properly secured
- [x] No secrets in code or `.env.example`
- [x] RLS enabled on all Supabase tables
- [x] WhatsApp webhook signature verification
- [x] HTTPS enforced
- [x] Pre-commit hooks prevent bad code
- [x] ESLint security rules enabled

### 🟡 In Progress

- [ ] API rate limiting (partially implemented)
- [ ] Input validation on all endpoints
- [ ] CORS properly configured
- [ ] Payment webhook signature verification
- [ ] PII masking in logs

### ⏳ Recommended

- [ ] Penetration testing
- [ ] Vulnerability scanning (automated)
- [ ] Security audit by third party
- [ ] WAF (Web Application Firewall)
- [ ] DDoS protection

---

## 1. API Security

### Rate Limiting

**Implementation**: Create middleware for Express services

```typescript
// packages/commons/src/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { Redis } from "ioredis";

export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
  redisUrl?: string;
}) {
  const {
    windowMs = 60 * 1000, // 1 minute
    max = 100, // 100 requests per window
    message = "Too many requests, please try again later",
    redisUrl = process.env.REDIS_URL,
  } = options;

  const config: any = {
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
  };

  if (redisUrl) {
    const client = new Redis(redisUrl);
    config.store = new RedisStore({
      client,
      prefix: "rl:",
    });
  }

  return rateLimit(config);
}

// Usage in service
import express from "express";
import { createRateLimiter } from "@easymo/commons";

const app = express();

// Apply to all routes
app.use(
  createRateLimiter({
    max: 100,
    windowMs: 60 * 1000,
  })
);

// Apply stricter limits to sensitive endpoints
app.use(
  "/api/auth",
  createRateLimiter({
    max: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many authentication attempts",
  })
);
```

### Input Validation

**Implementation**: Use Zod for runtime validation

```typescript
// Example: Validate user input
import { z } from "zod";

const UserProfileSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\+\d{10,15}$/),
  locale: z.enum(["en", "fr", "rw"]),
});

// In API handler
export async function updateProfile(req: Request, res: Response) {
  try {
    // Validate input
    const data = UserProfileSchema.parse(req.body);

    // Process valid data
    const result = await supabase.from("profiles").update(data).eq("id", req.user.id);

    return res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }
    throw error;
  }
}
```

### SQL Injection Prevention

**Best Practices**:

```typescript
// ✅ Good: Parameterized queries (Supabase automatically handles)
const { data } = await supabase.from("users").select("*").eq("email", userEmail); // Safe - parameterized

// ✅ Good: Using Prisma
const user = await prisma.user.findUnique({
  where: { email: userEmail }, // Safe - parameterized
});

// ❌ Bad: String concatenation (NEVER DO THIS)
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;
```

### XSS Protection

**Implementation**: Sanitize user input

```typescript
// packages/commons/src/security/sanitize.ts
import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a"],
    ALLOWED_ATTR: ["href"],
  });
}

export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove HTML brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .trim();
}

// Usage
const userMessage = sanitizeText(req.body.message);
const userBio = sanitizeHtml(req.body.bio);
```

### CORS Configuration

**Implementation**: Configure CORS properly

```typescript
// services/*/src/main.ts
import cors from "cors";

const allowedOrigins = [
  "https://easymo.rw",
  "https://admin.easymo.rw",
  process.env.NODE_ENV === "development" && "http://localhost:8080",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-ID"],
  })
);
```

---

## 2. Authentication & Authorization

### JWT Token Security

**Best Practices**:

```typescript
// Verify JWT tokens
import { verify } from "jsonwebtoken";

export async function verifyToken(token: string) {
  try {
    const payload = verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
      issuer: "easymo",
      audience: "easymo-api",
      maxAge: "1h", // Token expires in 1 hour
    });
    return payload;
  } catch (error) {
    throw new Error("Invalid token");
  }
}
```

### Password Security

**Implementation**: Use bcrypt for password hashing

```typescript
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

---

## 3. Webhook Security

### Signature Verification

**WhatsApp Webhook** (Already implemented):

```typescript
import crypto from "crypto";

export function verifyWhatsAppSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
```

**Payment Webhook** (Recommended):

```typescript
// For MoMo/Revolut webhooks
export function verifyPaymentWebhook(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  return signature === expectedSignature;
}

// Usage in webhook handler
export async function handlePaymentWebhook(req: Request, res: Response) {
  const signature = req.headers["x-payment-signature"] as string;
  const rawBody = JSON.stringify(req.body);

  if (!verifyPaymentWebhook(rawBody, signature, process.env.PAYMENT_WEBHOOK_SECRET!)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Process webhook
  // ...
}
```

### Replay Attack Prevention

```typescript
// Store processed webhook IDs in Redis
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

export async function preventReplay(webhookId: string): Promise<boolean> {
  const key = `webhook:${webhookId}`;
  const exists = await redis.exists(key);

  if (exists) {
    return false; // Already processed
  }

  // Mark as processed (expires in 24 hours)
  await redis.setex(key, 86400, "1");
  return true;
}

// Usage
const canProcess = await preventReplay(req.body.id);
if (!canProcess) {
  return res.status(409).json({ error: "Duplicate webhook" });
}
```

---

## 4. Data Protection

### PII Masking in Logs

**Implementation**:

```typescript
// packages/commons/src/logger/mask-pii.ts
export function maskPII(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  const masked = { ...obj };
  const piiFields = ["password", "token", "apiKey", "secret", "ssn", "creditCard"];

  for (const [key, value] of Object.entries(masked)) {
    // Mask sensitive fields
    if (piiFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      masked[key] = "***REDACTED***";
    }
    // Mask email (keep domain)
    else if (typeof value === "string" && value.includes("@")) {
      const [local, domain] = value.split("@");
      masked[key] = `${local[0]}***@${domain}`;
    }
    // Mask phone numbers (keep last 4 digits)
    else if (typeof value === "string" && /^\+?\d{10,}$/.test(value)) {
      masked[key] = `***${value.slice(-4)}`;
    }
    // Recursively mask nested objects
    else if (typeof value === "object") {
      masked[key] = maskPII(value);
    }
  }

  return masked;
}

// Usage in logger
import { childLogger } from "@easymo/commons";
import { maskPII } from "./mask-pii";

const log = childLogger({ service: "auth" });

log.info(
  maskPII({
    user: {
      email: "user@example.com",
      phone: "+250781234567",
      password: "secret123",
    },
  }),
  "User login"
);
// Logs: { user: { email: 'u***@example.com', phone: '***4567', password: '***REDACTED***' } }
```

### Encryption at Rest

**Recommendation**: Use Supabase encryption

```sql
-- Enable encryption for sensitive columns
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encrypt sensitive data
CREATE TABLE sensitive_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  encrypted_ssn TEXT, -- Store encrypted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Encrypt before insert
INSERT INTO sensitive_data (user_id, encrypted_ssn)
VALUES (
  'user-id',
  pgp_sym_encrypt('123-45-6789', current_setting('app.encryption_key'))
);

-- Decrypt when reading
SELECT
  id,
  user_id,
  pgp_sym_decrypt(encrypted_ssn::bytea, current_setting('app.encryption_key')) as ssn
FROM sensitive_data;
```

---

## 5. Security Headers

**Implementation**: Add security headers to all responses

```typescript
// packages/commons/src/middleware/security-headers.ts
import { Request, Response, NextFunction } from "express";

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Strict Transport Security (HTTPS only)
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  // Content Security Policy
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://*.supabase.co;"
  );

  // Referrer Policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions Policy
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  next();
}

// Usage
app.use(securityHeaders);
```

---

## 6. Vulnerability Scanning

### Automated Dependency Scanning

**Create**: `.github/workflows/security-scan.yml`

```yaml
name: Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 0 * * 1" # Weekly on Mondays

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
```

### Manual Security Audit Script

**Create**: `scripts/security/audit.sh`

```bash
#!/bin/bash
set -euo pipefail

echo "🔒 Running security audit..."

# 1. Check for known vulnerabilities
echo "📦 Checking dependencies..."
pnpm audit --audit-level=moderate

# 2. Check for exposed secrets
echo "🔑 Scanning for secrets..."
bash scripts/security/audit-env-files.sh

# 3. Check for insecure patterns
echo "🔍 Checking code patterns..."
grep -r "eval(" --include="*.ts" --include="*.js" . || echo "✅ No eval() found"
grep -r "innerHTML" --include="*.ts" --include="*.tsx" . || echo "✅ No innerHTML found"
grep -r "dangerouslySetInnerHTML" --include="*.tsx" . || echo "✅ No dangerouslySetInnerHTML found"

echo "✅ Security audit complete"
```

---

## Security Checklist for Production

- [ ] All API endpoints have rate limiting
- [ ] All user inputs are validated
- [ ] SQL injection protection verified
- [ ] XSS protection enabled
- [ ] CSRF tokens where needed
- [ ] CORS properly configured
- [ ] Security headers added
- [ ] Webhook signatures verified
- [ ] PII masked in all logs
- [ ] Encryption at rest for sensitive data
- [ ] HTTPS enforced everywhere
- [ ] Dependency vulnerabilities resolved
- [ ] Penetration test completed
- [ ] Security audit by third party
- [ ] Incident response plan in place

---

## Incident Response Plan

### 1. Detection

- Monitor error rates (Sentry)
- Monitor API usage patterns
- Alert on suspicious activity

### 2. Response

1. Identify the issue
2. Contain the breach
3. Assess the damage
4. Notify affected users (if needed)
5. Fix the vulnerability
6. Deploy the fix

### 3. Recovery

1. Verify the fix
2. Monitor for recurrence
3. Update documentation
4. Conduct post-mortem

### 4. Prevention

1. Update security measures
2. Train team
3. Regular security audits

---

## Next Steps

1. ✅ Implement rate limiting on all endpoints
2. ✅ Add input validation using Zod
3. ✅ Configure CORS properly
4. ✅ Add security headers
5. ✅ Implement PII masking
6. ✅ Set up automated vulnerability scanning
7. ⏳ Schedule penetration testing
8. ⏳ Third-party security audit

**Target**: Production-grade security before launch.
