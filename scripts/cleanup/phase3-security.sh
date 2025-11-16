#!/bin/bash
# PHASE 3: Security Hardening
# Implement critical security fixes from LOGIN_INTERFACE_REVIEW.md

set -e

echo "🔒 Starting Phase 3: Security Hardening"
echo "========================================"

cd /Users/jeanbosco/workspace/easymo-/admin-app

# 3.1 Install Security Dependencies
echo ""
echo "📦 Step 3.1: Installing security dependencies..."

if ! grep -q '"bcrypt"' package.json; then
  echo "  Installing bcrypt for password hashing..."
  npm install bcrypt @types/bcrypt
fi

if ! grep -q '"lru-cache"' package.json; then
  echo "  Installing lru-cache for rate limiting..."
  npm install lru-cache
fi

echo "  ✓ Security dependencies installed"

# 3.2 Create Rate Limiting Module
echo ""
echo "🛡️  Step 3.2: Creating rate limiting module..."

mkdir -p lib/server

cat > lib/server/rate-limit.ts << 'EOF'
import { LRUCache } from 'lru-cache';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  lockedUntil?: number;
}

const rateLimitStore = new LRUCache<string, RateLimitEntry>({
  max: 500,
  ttl: 15 * 60 * 1000, // 15 minutes
});

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export function checkRateLimit(
  identifier: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  // Check if account is locked
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.lockedUntil,
      retryAfter: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }
  
  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(identifier, newEntry);
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetAt: newEntry.resetAt,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= maxAttempts) {
    // Lock account
    entry.lockedUntil = now + windowMs;
    rateLimitStore.set(identifier, entry);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil(windowMs / 1000),
    };
  }
  
  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);
  
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: entry.resetAt,
  };
}

export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}
EOF

echo "  ✓ Created lib/server/rate-limit.ts"

# 3.3 Create CSRF Protection Module
echo ""
echo "🛡️  Step 3.3: Creating CSRF protection module..."

cat > lib/server/csrf.ts << 'EOF'
import { createHmac, randomBytes } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.ADMIN_SESSION_SECRET || 'dev-csrf-secret-change-in-prod';

if (CSRF_SECRET === 'dev-csrf-secret-change-in-prod' && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  CSRF_SECRET not set! Using fallback. Set CSRF_SECRET in production!');
}

export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('base64url');
  const signature = createHmac('sha256', CSRF_SECRET)
    .update(token)
    .digest('base64url');
  return `${token}.${signature}`;
}

export function validateCsrfToken(token: string | null): boolean {
  if (!token) return false;
  
  const [tokenPart, signature] = token.split('.');
  if (!tokenPart || !signature) return false;
  
  try {
    const expectedSignature = createHmac('sha256', CSRF_SECRET)
      .update(tokenPart)
      .digest('base64url');
    
    return signature === expectedSignature;
  } catch {
    return false;
  }
}
EOF

echo "  ✓ Created lib/server/csrf.ts"

# 3.4 Update Login API Route with Security
echo ""
echo "🔐 Step 3.4: Updating login route with security..."

# Backup original
cp app/api/auth/login/route.ts app/api/auth/login/route.ts.backup-phase3

cat > app/api/auth/login/route.ts << 'EOF'
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminCredential } from "@/lib/server/admin-credentials";
import { writeSessionToCookies } from "@/lib/server/session";
import { checkRateLimit, clearRateLimit } from "@/lib/server/rate-limit";
import { validateCsrfToken } from "@/lib/server/csrf";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
  csrfToken: z.string().optional(), // Optional for now, will be required later
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const payload = loginSchema.parse(body);
    
    // CSRF validation (warn but don't block during migration)
    const csrfToken = request.headers.get('x-csrf-token') || payload.csrfToken;
    if (csrfToken && !validateCsrfToken(csrfToken)) {
      console.warn('Invalid CSRF token detected');
      // Don't block yet, just log
    }
    
    // Rate limiting by email
    const rateLimit = checkRateLimit(`login:${payload.email}`, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: "rate_limit_exceeded",
          message: `Too many login attempts. Try again in ${rateLimit.retryAfter} seconds.`,
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter || 900),
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.floor(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    // Verify credentials
    const credential = verifyAdminCredential(payload.email, payload.password);
    
    if (!credential) {
      // Don't reveal whether email exists or password is wrong
      return NextResponse.json(
        {
          error: "invalid_credentials",
          message: "Email or password is incorrect.",
        },
        {
          status: 401,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": String(rateLimit.remaining - 1),
            "X-RateLimit-Reset": String(Math.floor(rateLimit.resetAt / 1000)),
          },
        }
      );
    }

    // Clear rate limit on successful login
    clearRateLimit(`login:${payload.email}`);

    // Create session with appropriate TTL
    const ttlMs = payload.rememberMe 
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 8 * 60 * 60 * 1000; // 8 hours

    writeSessionToCookies({
      actorId: credential.actorId,
      label: credential.label ?? credential.username ?? credential.email,
      ttlMs,
    });

    const response = NextResponse.json({
      actorId: credential.actorId,
      label: credential.label ?? credential.username ?? null,
    });

    // Add security headers
    response.headers.set("x-admin-session-refreshed", "true");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    
    if (process.env.NODE_ENV === 'production') {
      response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid email or password format." },
        { status: 400 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { error: "server_error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
EOF

echo "  ✓ Updated app/api/auth/login/route.ts with rate limiting and CSRF"

# 3.5 Remove Console Logs from Production
echo ""
echo "🧹 Step 3.5: Removing console.log statements..."

# Find and remove console.log (but keep console.error and console.warn)
find components lib -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" ! -name "*.spec.*" -exec sed -i.console-backup 's/console\.log(/\/\/ console.log(/g' {} \; 2>/dev/null || true

echo "  ✓ Commented out console.log statements (backups: *.console-backup)"

# 3.6 Update Environment Variables Documentation
echo ""
echo "📝 Step 3.6: Updating environment documentation..."

if [ -f ".env.example" ]; then
  # Add CSRF_SECRET if not present
  if ! grep -q "CSRF_SECRET" .env.example; then
    cat >> .env.example << 'EOF'

# Security (Phase 3 additions)
# ==============================

# CSRF Protection Secret (min 32 characters)
CSRF_SECRET=your-csrf-secret-min-32-characters-here

# Note: Passwords in ADMIN_ACCESS_CREDENTIALS should be bcrypt hashed
# Generate hash: node -e "console.log(require('bcrypt').hashSync('password', 10))"
EOF
  fi
  echo "  ✓ Updated .env.example with security variables"
fi

# 3.7 Create Security Audit Script
echo ""
echo "🔍 Step 3.7: Creating security audit script..."

mkdir -p ../../scripts/utilities

cat > ../../scripts/utilities/audit-security.sh << 'EOF'
#!/bin/bash
# Security audit script

echo "🔍 Running Security Audit..."
echo ""

cd "$(dirname "$0")/../.."

# Check for plain text passwords in env files
echo "1. Checking for plain text passwords..."
if grep -r "password.*:" admin-app/.env* 2>/dev/null | grep -v "#" | grep -v "passwordHash"; then
  echo "  ⚠️  WARNING: Plain text passwords found in .env files"
else
  echo "  ✓ No plain text passwords found"
fi

# Check for service role in client variables
echo ""
echo "2. Checking for service role leaks..."
if grep -r "VITE_.*SERVICE_ROLE\|NEXT_PUBLIC_.*SERVICE_ROLE" admin-app/.env* 2>/dev/null; then
  echo "  ❌ CRITICAL: Service role key in client-side variable!"
else
  echo "  ✓ No service role leaks detected"
fi

# Check for console.log in production code
echo ""
echo "3. Checking for console.log statements..."
log_count=$(find admin-app/components admin-app/lib -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" -exec grep -l "console\.log" {} \; 2>/dev/null | wc -l)
if [ "$log_count" -gt 0 ]; then
  echo "  ⚠️  WARNING: $log_count files with console.log found"
else
  echo "  ✓ No console.log statements found"
fi

# Check for required security env vars
echo ""
echo "4. Checking for required security variables..."
required_vars=("ADMIN_SESSION_SECRET" "CSRF_SECRET")
for var in "${required_vars[@]}"; do
  if grep -q "^$var=" admin-app/.env 2>/dev/null; then
    echo "  ✓ $var is set"
  else
    echo "  ⚠️  WARNING: $var is not set"
  fi
done

# Check for weak session secrets
echo ""
echo "5. Checking session secret strength..."
if [ -f admin-app/.env ]; then
  secret=$(grep "^ADMIN_SESSION_SECRET=" admin-app/.env | cut -d'=' -f2)
  if [ ${#secret} -lt 32 ]; then
    echo "  ⚠️  WARNING: ADMIN_SESSION_SECRET is too short (< 32 characters)"
  else
    echo "  ✓ Session secret has adequate length"
  fi
fi

echo ""
echo "✅ Security audit complete"
EOF

chmod +x ../../scripts/utilities/audit-security.sh

echo "  ✓ Created scripts/utilities/audit-security.sh"

# 3.8 Summary
echo ""
echo "📊 Summary:"
echo "  - Rate limiting implemented (5 attempts per 15 minutes)"
echo "  - CSRF protection module created"
echo "  - Login route secured with rate limiting"
echo "  - Security headers added to responses"
echo "  - Console.log statements removed/commented"
echo "  - Security audit script created"
echo ""
echo "✅ Phase 3 Complete!"
echo "===================="
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Update .env with CSRF_SECRET:"
echo "   CSRF_SECRET=$(openssl rand -base64 32)"
echo ""
echo "2. Hash existing passwords:"
echo "   node -e \"console.log(require('bcrypt').hashSync('your-password', 10))\""
echo ""
echo "3. Run security audit:"
echo "   bash scripts/utilities/audit-security.sh"
echo ""
echo "4. Test login with rate limiting:"
echo "   - Try 6 failed logins to trigger rate limit"
echo "   - Verify successful login clears rate limit"
echo ""
echo "5. Proceed to Phase 4:"
echo "   - Code standardization"
echo "   - ESLint configuration"
echo "   - TypeScript strict mode"
