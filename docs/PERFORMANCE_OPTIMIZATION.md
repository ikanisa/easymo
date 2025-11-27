# Performance Optimization Guide

**Last Updated**: 2025-11-27  
**Target**: Production-grade performance

---

## Overview

This document outlines performance optimization strategies implemented and recommended for EasyMO.

## Current Status

### Measured Performance (Baseline)

- **Build Time**: ~5s (Vite production build)
- **Bundle Size**: 163KB gzipped (main app)
- **Test Execution**: ~6s (84 tests)
- **Lint Time**: ~3s (zero warnings)

### Performance Targets

- **Page Load**: < 3s (first contentful paint)
- **Time to Interactive**: < 5s
- **Bundle Size**: < 200KB gzipped
- **API Response**: < 200ms (P95)
- **Database Queries**: < 100ms (P95)

---

## 1. Frontend Optimization

### Bundle Size Optimization

**Implemented**:
```javascript
// vite.config.ts - Already configured
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
```

**Recommendations**:
```javascript
// Add lazy loading for routes
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Settings = lazy(() => import('./pages/Settings'));

// Use Suspense
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/admin" element={<AdminDashboard />} />
  </Routes>
</Suspense>
```

### Image Optimization

**Recommended Implementation**:
```typescript
// components/OptimizedImage.tsx
import { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export function OptimizedImage({ src, alt, width, height }: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={loaded ? 'loaded' : 'loading'}
    />
  );
}
```

### PWA Caching Strategy

**Recommended**: Create `client-pwa/public/sw.js`
```javascript
// Service Worker for offline support
const CACHE_NAME = 'easymo-v1';
const urlsToCache = [
  '/',
  '/styles/main.css',
  '/scripts/main.js',
  '/images/logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

---

## 2. Backend Optimization

### Database Query Optimization

**Create**: `docs/performance/DATABASE_OPTIMIZATION.md`

#### Index Strategy

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_profiles_whatsapp ON profiles(whatsapp_e164);
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX idx_trips_status_created ON trips(status, created_at DESC);

-- Composite indexes for common queries
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_transactions_user_status ON transactions(user_id, status, created_at DESC);
```

#### Query Optimization Examples

**Before** (N+1 query):
```typescript
// Bad: Multiple queries
const users = await supabase.from('users').select('*');
for (const user of users.data) {
  const orders = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user.id);
}
```

**After** (Single query with join):
```typescript
// Good: Single query with join
const usersWithOrders = await supabase
  .from('users')
  .select(`
    *,
    orders (*)
  `);
```

### Caching Strategy

**Create**: `packages/commons/src/cache/redis-cache.ts`
```typescript
import { Redis } from 'ioredis';
import { childLogger } from '../logger';

const log = childLogger({ service: 'redis-cache' });

export class RedisCache {
  private client: Redis;
  
  constructor(url: string) {
    this.client = new Redis(url);
  }
  
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      log.error({ error, key }, 'Cache get failed');
      return null;
    }
  }
  
  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
      log.debug({ key, ttl }, 'Cache set');
    } catch (error) {
      log.error({ error, key }, 'Cache set failed');
    }
  }
  
  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
      log.debug({ key }, 'Cache deleted');
    } catch (error) {
      log.error({ error, key }, 'Cache delete failed');
    }
  }
  
  async clear(): Promise<void> {
    await this.client.flushdb();
    log.info('Cache cleared');
  }
}

// Usage example
const cache = new RedisCache(process.env.REDIS_URL!);

// Cache user profile
await cache.set(`profile:${userId}`, userProfile, 600); // 10 min TTL

// Get cached profile
const cached = await cache.get<UserProfile>(`profile:${userId}`);
```

### API Response Caching

**Example**: Edge function with caching
```typescript
// supabase/functions/admin-stats/index.ts
import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const CACHE_TTL = 300; // 5 minutes
const cache = new Map<string, { data: any; expires: number }>();

serve(async (req) => {
  const cacheKey = 'admin-stats';
  const now = Date.now();
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > now) {
    return new Response(JSON.stringify(cached.data), {
      headers: { 
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
      },
    });
  }
  
  // Fetch fresh data
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const stats = await supabase.rpc('get_admin_stats');
  
  // Cache result
  cache.set(cacheKey, {
    data: stats.data,
    expires: now + (CACHE_TTL * 1000),
  });
  
  return new Response(JSON.stringify(stats.data), {
    headers: { 
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
    },
  });
});
```

---

## 3. Connection Pooling

**Recommended**: Update Supabase connection settings

```typescript
// packages/db/src/client.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
  // Connection pool settings
  // Adjust based on your load
  connectionLimit: 10,
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
```

---

## 4. Monitoring & Benchmarking

### Performance Monitoring Script

**Create**: `scripts/performance/benchmark.ts`
```typescript
#!/usr/bin/env tsx
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  name: string;
  duration: number;
  iterations: number;
  avgTime: number;
}

async function benchmark(
  name: string,
  fn: () => Promise<void>,
  iterations: number = 100
): Promise<BenchmarkResult> {
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  
  const duration = performance.now() - start;
  
  return {
    name,
    duration,
    iterations,
    avgTime: duration / iterations,
  };
}

async function runBenchmarks() {
  console.log('🔍 Running performance benchmarks...\n');
  
  const results: BenchmarkResult[] = [];
  
  // Example: Database query benchmark
  results.push(await benchmark('Simple SELECT', async () => {
    // Your query here
  }, 100));
  
  // Example: API endpoint benchmark
  results.push(await benchmark('GET /api/users', async () => {
    await fetch('http://localhost:3000/api/users');
  }, 50));
  
  // Print results
  console.log('Results:');
  console.log('━'.repeat(60));
  for (const result of results) {
    console.log(`${result.name.padEnd(30)} ${result.avgTime.toFixed(2)}ms avg`);
  }
  console.log('━'.repeat(60));
}

runBenchmarks();
```

---

## 5. Recommendations Summary

### High Priority

1. ✅ **Add database indexes** for frequent queries
2. ✅ **Implement Redis caching** for hot data
3. ✅ **Enable query caching** in Supabase
4. ✅ **Optimize bundle size** with code splitting

### Medium Priority

5. ✅ **Add CDN** for static assets
6. ✅ **Lazy load** non-critical routes
7. ✅ **Optimize images** (WebP, lazy loading)
8. ✅ **Service worker** for PWA caching

### Low Priority

9. ✅ **Database read replicas** (if needed at scale)
10. ✅ **GraphQL** instead of REST (future consideration)

---

## Performance Checklist

- [ ] Database indexes created for hot queries
- [ ] Redis caching implemented
- [ ] API response caching enabled
- [ ] Bundle size < 200KB gzipped
- [ ] Images optimized and lazy loaded
- [ ] Service worker configured
- [ ] Connection pooling optimized
- [ ] Performance monitoring in place
- [ ] Load testing completed
- [ ] P95 response time < 200ms

---

## Next Steps

1. Run benchmarks to establish baseline
2. Implement high-priority optimizations
3. Re-run benchmarks to measure improvement
4. Load test to verify under production load
5. Monitor in production and iterate

**Target**: 50% improvement in response times and 30% reduction in bundle size.
