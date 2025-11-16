import { createHmac, randomBytes } from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.ADMIN_SESSION_SECRET || 'dev-csrf-secret-change-in-prod';

if (CSRF_SECRET === 'dev-csrf-secret-change-in-prod' && process.env.NODE_ENV === 'production') {
  console.warn('⚠️  CSRF_SECRET not set! Using fallback.');
}

export function generateCsrfToken(): string {
  const token = randomBytes(32).toString('base64url');
  const signature = createHmac('sha256', CSRF_SECRET).update(token).digest('base64url');
  return `${token}.${signature}`;
}

export function validateCsrfToken(token: string | null): boolean {
  if (!token) return false;
  const [tokenPart, signature] = token.split('.');
  if (!tokenPart || !signature) return false;
  try {
    const expected = createHmac('sha256', CSRF_SECRET).update(tokenPart).digest('base64url');
    return signature === expected;
  } catch {
    return false;
  }
}
