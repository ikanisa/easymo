# Server Component Error Debugging Guide

## Overview
Next.js intentionally hides detailed error messages in production to prevent leaking sensitive information. When a Server Component fails to render, you'll see a generic error with a **digest** property that acts as a correlation ID.

## Quick Diagnosis Workflow

### 1. **Capture the Error Digest**
When an error occurs in production:
- Open browser console (F12)
- Look for error logs with a `digest` property
- Copy the digest value (e.g., `"2834729384"`)

Example console output:
```javascript
{
  message: "An error occurred in the Server Components render...",
  digest: "2834729384",
  timestamp: "2025-11-07T10:11:03.497Z"
}
```

### 2. **Find Server-Side Error Details**

#### Option A: Search Sentry Dashboard
1. Go to your Sentry project
2. Search for the digest: `digest:"2834729384"`
3. View the full exception with stack trace and context

#### Option B: Search Server Logs
```bash
# Search deployment logs (Netlify/Vercel/etc.)
grep "2834729384" server-logs.txt

# Or use your logging service (CloudWatch, Datadog, etc.)
# Filter by: digest = "2834729384"
```

### 3. **Reproduce Locally**
```bash
cd admin-app

# Development mode shows full error details
npm run dev

# Or test with production build locally
npm run build
npm start

# With Netlify CLI
netlify dev
```

## Error Tracking Setup

### Required Environment Variables

#### Production Environment
```bash
# Server-side error tracking (REQUIRED)
SENTRY_DSN=https://your-project@sentry.io/123456

# Client-side error tracking (REQUIRED)
NEXT_PUBLIC_SENTRY_DSN=https://your-project@sentry.io/123456

# Optional: Sentry environment
SENTRY_ENVIRONMENT=production

# Optional: Release tracking
SENTRY_RELEASE=v1.2.3
```

#### Verify Configuration
```bash
# Check if Sentry is enabled
echo $SENTRY_DSN
echo $NEXT_PUBLIC_SENTRY_DSN

# Test Sentry connection
curl -X POST "https://sentry.io/api/0/projects/YOUR_ORG/YOUR_PROJECT/events/" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Instrumentation Hook
The app now includes `instrumentation.ts` which:
- Captures unhandled rejections
- Captures uncaught exceptions  
- Logs server startup issues
- Automatically correlates errors with digests

## Error Boundaries

### App-Level Errors
- **File**: `app/global-error.tsx`
- **Scope**: Root-level errors, entire app crashes
- **Features**: 
  - Logs error digest in dev mode
  - Captures to Sentry with correlation ID
  - Shows user-friendly error page

### Page-Level Errors
- **File**: `app/error.tsx`
- **Scope**: Page and component errors within layouts
- **Features**:
  - Shows digest in development mode
  - Provides "Try again" and "Go back" actions
  - Captures full context to Sentry

## Common Server Component Errors

### 1. **Async Data Fetching Issues**
```typescript
// ❌ Missing error handling
async function Page() {
  const data = await fetch('/api/data').then(r => r.json());
  return <div>{data.value}</div>;
}

// ✅ Proper error handling
async function Page() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) {
      console.error('API fetch failed', {
        status: res.status,
        url: res.url,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`API returned ${res.status}`);
    }
    const data = await res.json();
    return <div>{data.value}</div>;
  } catch (error) {
    console.error('Page render error', { error });
    throw error; // Let error boundary handle it
  }
}
```

### 2. **Missing Environment Variables**
```typescript
// ❌ No validation
const apiUrl = process.env.NEXT_PUBLIC_API_URL;

// ✅ Validate required env vars
function getApiUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }
  return apiUrl;
}
```

### 3. **Database Connection Failures**
```typescript
// Add detailed logging
async function getData() {
  try {
    const result = await db.query('SELECT * FROM users');
    return result.rows;
  } catch (error) {
    console.error('Database query failed', {
      error: error.message,
      code: error.code,
      query: 'SELECT * FROM users',
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
}
```

## Adding Server-Side Logging

### For API Routes
```typescript
import { captureException } from '@/lib/server/sentry';

export async function GET(request: Request) {
  try {
    // Your logic here
    return Response.json({ success: true });
  } catch (error) {
    console.error('API route error', {
      path: request.url,
      method: request.method,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
    captureException(error, {
      route: request.url,
      method: request.method,
    });
    
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### For Server Components
```typescript
import { captureException } from '@/lib/server/sentry';

async function MyServerComponent({ id }: { id: string }) {
  try {
    const data = await fetchData(id);
    return <div>{data.title}</div>;
  } catch (error) {
    console.error('Server component error', {
      component: 'MyServerComponent',
      id,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
    
    captureException(error, {
      component: 'MyServerComponent',
      id,
    });
    
    throw error; // Trigger error boundary
  }
}
```

## Deployment Checklist

- [ ] `SENTRY_DSN` configured in production
- [ ] `NEXT_PUBLIC_SENTRY_DSN` configured in production  
- [ ] Error boundaries are in place (`global-error.tsx`, `error.tsx`)
- [ ] Instrumentation hook is enabled (`instrumentationHook: true`)
- [ ] Server logs are accessible (Netlify/Vercel dashboard)
- [ ] Test error tracking with a test error in staging

## Testing Error Tracking

### Create Test Error
```typescript
// Add to a test page: app/test-error/page.tsx
export default function TestErrorPage() {
  if (Math.random() > 0.5) {
    throw new Error('Test error for Sentry - Server Component');
  }
  return <div>Test page</div>;
}
```

### Verify in Sentry
1. Navigate to `/test-error` in production
2. Check Sentry dashboard for the error
3. Verify digest appears in error details
4. Confirm stack trace is captured

## Troubleshooting

### "Sentry not capturing errors"
- Verify `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are set
- Check Sentry project settings and DSN validity
- Ensure instrumentation is enabled in `next.config.mjs`
- Check network tab for Sentry API calls

### "Can't find error in logs"
- Ensure you're searching the correct environment (production vs staging)
- Check timestamp - server logs may be delayed
- Verify log retention period hasn't expired
- Search by multiple terms: digest, error message, route path

### "Digest not showing in console"
- Check browser console is set to "All levels"
- Error might be caught before reaching boundary
- Verify error boundaries are properly configured
- Check for custom error handling that swallows errors

## Resources

- [Next.js Error Handling](https://nextjs.org/docs/app/building-your-application/routing/error-handling)
- [Sentry Next.js Setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
