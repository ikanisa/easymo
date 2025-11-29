# 🏥 Phase 2: Health & Monitoring Implementation Guide

**Status:** ✅ IN PROGRESS  
**Priority:** 🔴 CRITICAL  
**Target:** All 13 microservices

---

## 📋 What's Being Implemented

### 1. Enhanced Health Checks ✅
- Comprehensive `/health` endpoints
- Database connectivity checks
- Redis connectivity checks
- Dependency health verification
- Timeout protection (5s database, 3s others)

### 2. Prometheus Metrics ✅ NEW
- HTTP request metrics (duration, count, size)
- Business operation metrics
- System metrics (CPU, memory, event loop)
- Custom metrics per service
- `/metrics` endpoint for Prometheus scraping

### 3. Structured Logging ✅ EXISTING
- Already implemented via `@easymo/commons`
- Pino logger with JSON output
- Correlation IDs via request context
- Child loggers per service

---

## 🔧 Implementation Steps

### Step 1: Update @easymo/commons Package

**Added:**
- ✅ `src/metrics.ts` - Prometheus metrics module (230 lines)
- ✅ `prom-client@^15.1.3` dependency
- ✅ Exported metrics module from index

**Features:**
```typescript
// Automatic HTTP metrics
const metrics = createMetricsRegistry('my-service');
app.use(metricsMiddleware(metrics));

// Metrics endpoint
app.get('/metrics', metricsHandler(metrics));

// Custom business metrics
metrics.recordBusinessOperation('user.created', durationSeconds, 'success');

// Measure async operations
const result = await metrics.measureDuration('process.payment', async () => {
  return await processPayment(data);
});
```

---

### Step 2: Enhanced Health Check Pattern

**Template for Services:**

```typescript
import {
  createHealthCheck,
  createMetricsRegistry,
  metricsMiddleware,
  metricsHandler,
} from '@easymo/commons';
import { PrismaService } from '@easymo/db';
import express from 'express';

const prisma = new PrismaService();
const metrics = createMetricsRegistry('attribution-service');

// Create health check with dependency checks
const healthCheck = createHealthCheck({
  version: process.env.npm_package_version || '1.0.0',
  database: async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },
  redis: async () => {
    if (!redisClient) return true; // Optional dependency
    try {
      await redisClient.ping();
      return true;
    } catch {
      return false;
    }
  },
  // Add more checks as needed
  external: {
    'supabase': async () => {
      // Check external API health
      return true;
    },
  },
});

const app = express();

// Add metrics middleware (tracks all HTTP requests)
app.use(metricsMiddleware(metrics));

// Health endpoint
app.get('/health', async (req, res) => {
  const result = await healthCheck();
  const statusCode = result.status === 'healthy' ? 200 :
                     result.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(result);
});

// Metrics endpoint
app.get('/metrics', metricsHandler(metrics));

// Business logic with metrics
app.post('/evaluate', async (req, res) => {
  const result = await metrics.measureDuration('evaluate.attribution', async () => {
    return await evaluateAttribution(req.body);
  });
  res.json(result);
});
```

---

### Step 3: Service-Specific Implementation

#### attribution-service

**Current Status:**
- ✅ Basic health endpoint exists
- ❌ No dependency checks
- ❌ No metrics

**Changes Needed:**
```typescript
// File: services/attribution-service/src/server.ts

import {
  createHealthCheck,
  createMetricsRegistry,
  metricsMiddleware,
  metricsHandler,
} from '@easymo/commons';

const metrics = createMetricsRegistry('attribution-service');

const healthCheck = createHealthCheck({
  version: process.env.npm_package_version || '1.0.0',
  database: async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  },
});

export function buildApp(deps: { prisma: PrismaService }): Express {
  const app = express();
  
  // Add metrics middleware BEFORE routes
  app.use(metricsMiddleware(metrics));
  
  // ... existing middleware ...

  // Enhanced health endpoint
  app.get(getAttributionServiceRoutePath("health"), async (_req, res) => {
    const result = await healthCheck();
    const statusCode = result.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(result);
  });

  // Metrics endpoint
  app.get('/metrics', metricsHandler(metrics));

  // ... rest of routes ...

  return app;
}
```

---

#### agent-core (NestJS)

**Current Status:**
- ✅ NestJS framework
- ❌ No health endpoint
- ❌ No metrics

**Changes Needed:**

```typescript
// File: services/agent-core/src/health/health.controller.ts (NEW)

import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '@easymo/db';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  async check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }
}

// File: services/agent-core/src/metrics/metrics.controller.ts (NEW)

import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { createMetricsRegistry, metricsHandler } from '@easymo/commons';

const metrics = createMetricsRegistry('agent-core');

@Controller()
export class MetricsController {
  @Get('metrics')
  async getMetrics(@Res() res: Response) {
    const handler = metricsHandler(metrics);
    return handler({}, res);
  }
}

// File: services/agent-core/src/app.module.ts (UPDATE)

import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health/health.controller';
import { MetricsController } from './metrics/metrics.controller';

@Module({
  imports: [
    TerminusModule, // Add this
    // ... existing imports
  ],
  controllers: [
    HealthController, // Add this
    MetricsController, // Add this
    // ... existing controllers
  ],
})
export class AppModule {}
```

---

#### Other Express Services

**Services to update (same pattern as attribution-service):**
- broker-orchestrator
- buyer-service
- profile
- ranking-service
- vendor-service
- video-orchestrator
- voice-bridge
- wallet-service
- whatsapp-pricing-server
- whatsapp-webhook-worker

**For each service:**

1. Import metrics and health check:
```typescript
import {
  createHealthCheck,
  createMetricsRegistry,
  metricsMiddleware,
  metricsHandler,
} from '@easymo/commons';
```

2. Create metrics registry:
```typescript
const metrics = createMetricsRegistry('SERVICE_NAME');
```

3. Create health check:
```typescript
const healthCheck = createHealthCheck({
  version: process.env.npm_package_version || '1.0.0',
  database: async () => {
    // Check database connection
  },
  redis: async () => {
    // Check Redis if used
  },
});
```

4. Add middleware:
```typescript
app.use(metricsMiddleware(metrics));
```

5. Add endpoints:
```typescript
app.get('/health', async (req, res) => {
  const result = await healthCheck();
  res.status(result.status === 'healthy' ? 200 : 503).json(result);
});

app.get('/metrics', metricsHandler(metrics));
```

---

## 📊 Metrics Available

### Automatic HTTP Metrics

**Collected by `metricsMiddleware`:**

1. **`SERVICE_http_request_duration_seconds`** (Histogram)
   - Labels: method, route, status_code
   - Buckets: 0.001s to 10s

2. **`SERVICE_http_requests_total`** (Counter)
   - Labels: method, route, status_code

3. **`SERVICE_http_request_size_bytes`** (Histogram)
   - Labels: method, route

4. **`SERVICE_http_response_size_bytes`** (Histogram)
   - Labels: method, route

### Business Metrics

**Use manually in business logic:**

1. **`SERVICE_business_operations_total`** (Counter)
   - Labels: operation, status
   ```typescript
   metrics.businessOperationTotal.inc({ operation: 'payment', status: 'success' });
   ```

2. **`SERVICE_business_operation_duration_seconds`** (Histogram)
   - Labels: operation
   ```typescript
   const result = await metrics.measureDuration('payment.process', async () => {
     return processPayment();
   });
   ```

3. **`SERVICE_active_connections`** (Gauge)
   - Labels: type
   ```typescript
   metrics.activeConnections.set({ type: 'websocket' }, 42);
   ```

4. **`SERVICE_queue_size`** (Gauge)
   - Labels: queue
   ```typescript
   metrics.queueSize.set({ queue: 'email' }, 150);
   ```

### System Metrics (Automatic)

**Collected by prom-client:**
- `process_cpu_user_seconds_total`
- `process_cpu_system_seconds_total`
- `process_resident_memory_bytes`
- `process_heap_bytes`
- `nodejs_eventloop_lag_seconds`
- `nodejs_gc_duration_seconds`
- And more...

---

## 🔍 Health Check Response Format

### Healthy Response (200 OK)
```json
{
  "status": "healthy",
  "timestamp": "2025-11-29T07:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "pass",
      "latencyMs": 5
    },
    "redis": {
      "status": "pass",
      "latencyMs": 2
    }
  }
}
```

### Degraded Response (200 OK)
```json
{
  "status": "degraded",
  "timestamp": "2025-11-29T07:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "pass",
      "latencyMs": 5
    },
    "redis": {
      "status": "warn",
      "message": "Connection timeout",
      "latencyMs": 3000
    }
  }
}
```

### Unhealthy Response (503 Service Unavailable)
```json
{
  "status": "unhealthy",
  "timestamp": "2025-11-29T07:30:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "fail",
      "message": "Connection refused",
      "latencyMs": 5000
    },
    "redis": {
      "status": "pass",
      "latencyMs": 2
    }
  }
}
```

---

## 🎯 Implementation Checklist

### Commons Package
- [x] Add metrics.ts module
- [x] Add prom-client dependency
- [x] Export metrics from index
- [ ] Build and test commons package
- [ ] Deploy updated commons

### Per Service (13 services)
- [ ] agent-core (NestJS - different pattern)
- [ ] attribution-service
- [ ] broker-orchestrator
- [ ] buyer-service
- [ ] profile
- [ ] ranking-service
- [ ] vendor-service
- [ ] video-orchestrator
- [ ] voice-bridge
- [ ] wallet-service
- [ ] whatsapp-pricing-server
- [ ] whatsapp-webhook-worker

### For Each Service:
- [ ] Add enhanced health check with dependency checks
- [ ] Add metrics middleware
- [ ] Add /metrics endpoint
- [ ] Add business-specific metrics
- [ ] Update package.json if needed
- [ ] Test health endpoint
- [ ] Test metrics endpoint
- [ ] Document custom metrics

---

## 🧪 Testing

### Test Health Endpoint
```bash
# Should return 200 with healthy status
curl http://localhost:3000/health

# Expected response
{
  "status": "healthy",
  "checks": {...},
  "timestamp": "...",
  "version": "1.0.0",
  "uptime": 123
}
```

### Test Metrics Endpoint
```bash
# Should return Prometheus format
curl http://localhost:3000/metrics

# Expected response (sample)
# HELP attribution_service_http_request_duration_seconds Duration of HTTP requests
# TYPE attribution_service_http_request_duration_seconds histogram
attribution_service_http_request_duration_seconds_bucket{le="0.001",method="GET",route="/health",status_code="200"} 10
...
```

### Test with Prometheus
```bash
# Add to prometheus.yml
scrape_configs:
  - job_name: 'easymo-services'
    static_configs:
      - targets:
        - 'attribution-service:3000'
        - 'buyer-service:3000'
        # ... all services
    metrics_path: '/metrics'
    scrape_interval: 15s
```

---

## 📈 Expected Results

### Before Phase 2:
- ❌ Basic health endpoints (just `{"status": "ok"}`)
- ❌ No dependency checks
- ❌ No metrics
- ❌ No observability

### After Phase 2:
- ✅ Comprehensive health checks with dependency verification
- ✅ Prometheus metrics on all services
- ✅ HTTP metrics (automatic)
- ✅ Business metrics (manual)
- ✅ System metrics (automatic)
- ✅ Production-ready observability

**Production Readiness:**
- Before: 6.5/10
- After: 7.5/10 (target)
- **Improvement: +1.0 point (+10%)**

---

## 🔄 Next Steps

1. **Build @easymo/commons**
   ```bash
   cd packages/commons
   pnpm install
   pnpm build
   ```

2. **Update services** (one by one)
   - Start with attribution-service (template)
   - Apply pattern to others
   - Test each service

3. **Setup Prometheus** (Phase 4)
   - Deploy Prometheus server
   - Configure scraping
   - Create Grafana dashboards
   - Setup alerts

4. **Document custom metrics**
   - Each service documents its business metrics
   - Create Grafana dashboard templates
   - Setup SLO/SLI monitoring

---

**Status:** 📝 Guide Complete  
**Next:** Build commons package and start service updates  
**Timeline:** 8-10 hours for all 13 services
