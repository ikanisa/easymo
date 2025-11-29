# Phase 4: Observability Infrastructure Implementation
**Created:** 2025-11-29  
**Target Completion:** 2025-12-06 (1 week)  
**Status:** 🟡 In Progress  

---

## 📋 EXECUTIVE SUMMARY

This phase implements comprehensive observability across all EasyMO microservices using:
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Loki** - Log aggregation
- **Alertmanager** - Alert routing and notification
- **OpenTelemetry** - Distributed tracing

**Target Services:** 12 microservices + Admin App + Edge Functions

---

## 🎯 OBJECTIVES

### Primary Goals
1. ✅ Real-time metrics collection from all services
2. ✅ Centralized log aggregation with search
3. ✅ Distributed request tracing
4. ✅ Automated alerting for critical issues
5. ✅ Production-ready dashboards

### Success Criteria
- [ ] All microservices exposing Prometheus metrics
- [ ] 95%+ log collection rate
- [ ] Alert firing within 60 seconds of incident
- [ ] <5s dashboard query response time
- [ ] 30-day metric retention

---

## 📊 CURRENT STATE ANALYSIS

### Existing Observability

| Service | Logging | Metrics | Tracing | Status |
|---------|---------|---------|---------|--------|
| agent-core | ✅ Pino | ❌ | ❌ | Partial |
| voice-bridge | ✅ Pino | ❌ | ❌ | Partial |
| wallet-service | ✅ Pino | ❌ | ❌ | Partial |
| ranking-service | ⚠️ Console | ❌ | ❌ | Poor |
| vendor-service | ✅ Pino | ❌ | ❌ | Partial |
| buyer-service | ✅ Pino | ❌ | ❌ | Partial |
| notification-service | ✅ Pino | ❌ | ❌ | Partial |
| admin-app | ✅ Sentry | ❌ | ❌ | Partial |
| Edge Functions | ⚠️ Basic | ❌ | ❌ | Poor |

**Key Issues:**
- No centralized metrics dashboard
- Logs scattered across services
- No request tracing across microservices
- Manual log inspection required for debugging
- No proactive alerting

---

## 🏗️ ARCHITECTURE DESIGN

### Observability Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     GRAFANA (Port 3000)                      │
│                  Unified Visualization Layer                 │
├─────────────────────────────────────────────────────────────┤
│  Dashboards:                                                 │
│  ├─ System Overview                                          │
│  ├─ Service Health                                           │
│  ├─ Business Metrics                                         │
│  ├─ Error Tracking                                           │
│  └─ Infrastructure                                           │
└─────────────────────────────────────────────────────────────┘
                           ↑
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌──────▼──────┐
│  PROMETHEUS  │  │      LOKI      │  │   TEMPO     │
│  (Port 9090) │  │  (Port 3100)   │  │ (Port 3200) │
│              │  │                │  │             │
│   Metrics    │  │     Logs       │  │   Traces    │
└───────┬──────┘  └────────┬───────┘  └──────┬──────┘
        │                  │                  │
        │                  │                  │
┌───────▼──────────────────▼──────────────────▼──────┐
│              Service Instrumentation                │
├─────────────────────────────────────────────────────┤
│  ├─ @easymo/commons (prom-client + pino)           │
│  ├─ OpenTelemetry SDK                               │
│  ├─ Custom Prometheus exporters                     │
│  └─ Structured logging with correlation IDs         │
└─────────────────────────────────────────────────────┘
        ↑
┌───────┴──────────────────────────────────────────┐
│  Microservices (12) + Admin App + Edge Functions │
└──────────────────────────────────────────────────┘
```

### Data Flow

```
1. Service emits metrics → Prometheus scrapes → Stores in TSDB
2. Service logs (JSON) → Promtail collects → Loki stores
3. Request traced → OpenTelemetry → Tempo stores spans
4. Grafana queries all 3 backends → Unified dashboard view
5. Alertmanager evaluates rules → Sends notifications
```

---

## 🔧 IMPLEMENTATION PLAN

### Week 1: Days 1-2 (Mon-Tue: Dec 2-3)

#### Task 1.1: Setup Monitoring Infrastructure
**Owner:** DevOps  
**Time:** 4 hours  

**1. Create Docker Compose for Monitoring Stack**

File: `monitoring/docker-compose.monitoring.yml`

```yaml
version: '3.8'

networks:
  monitoring:
    driver: bridge

volumes:
  prometheus_data: {}
  grafana_data: {}
  loki_data: {}
  tempo_data: {}

services:
  # Prometheus - Metrics Collection
  prometheus:
    image: prom/prometheus:v2.48.0
    container_name: easymo-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/alerts.yml:/etc/prometheus/alerts.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    networks:
      - monitoring
    restart: unless-stopped

  # Grafana - Visualization
  grafana:
    image: grafana/grafana:10.2.2
    container_name: easymo-grafana
    ports:
      - "3001:3000"  # Port 3000 used by admin-app
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:-CHANGE_ME_IN_PRODUCTION}
      - GF_INSTALL_PLUGINS=grafana-piechart-panel,grafana-clock-panel
      - GF_SERVER_ROOT_URL=https://monitoring.easymo.dev
      - GF_AUTH_ANONYMOUS_ENABLED=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    networks:
      - monitoring
    depends_on:
      - prometheus
      - loki
      - tempo
    restart: unless-stopped

  # Loki - Log Aggregation
  loki:
    image: grafana/loki:2.9.3
    container_name: easymo-loki
    ports:
      - "3100:3100"
    volumes:
      - ./loki/loki-config.yml:/etc/loki/local-config.yml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yml
    networks:
      - monitoring
    restart: unless-stopped

  # Promtail - Log Shipper
  promtail:
    image: grafana/promtail:2.9.3
    container_name: easymo-promtail
    volumes:
      - ./promtail/promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring
    depends_on:
      - loki
    restart: unless-stopped

  # Tempo - Distributed Tracing
  tempo:
    image: grafana/tempo:2.3.1
    container_name: easymo-tempo
    ports:
      - "3200:3200"   # Tempo HTTP
      - "4317:4317"   # OTLP gRPC
      - "4318:4318"   # OTLP HTTP
    volumes:
      - ./tempo/tempo.yml:/etc/tempo/tempo.yml
      - tempo_data:/var/tempo
    command: [ "-config.file=/etc/tempo/tempo.yml" ]
    networks:
      - monitoring
    restart: unless-stopped

  # Alertmanager - Alert Routing
  alertmanager:
    image: prom/alertmanager:v0.26.0
    container_name: easymo-alertmanager
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    networks:
      - monitoring
    restart: unless-stopped

  # Node Exporter - Host Metrics
  node-exporter:
    image: prom/node-exporter:v1.7.0
    container_name: easymo-node-exporter
    ports:
      - "9100:9100"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    networks:
      - monitoring
    restart: unless-stopped

  # Postgres Exporter - Database Metrics
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.15.0
    container_name: easymo-postgres-exporter
    ports:
      - "9187:9187"
    environment:
      - DATA_SOURCE_NAME=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/easymo?sslmode=disable
    networks:
      - monitoring
    restart: unless-stopped

  # Redis Exporter - Cache Metrics
  redis-exporter:
    image: oliver006/redis_exporter:v1.55.0
    container_name: easymo-redis-exporter
    ports:
      - "9121:9121"
    environment:
      - REDIS_ADDR=redis://redis:6379
    networks:
      - monitoring
    restart: unless-stopped
```

**2. Create Prometheus Configuration**

File: `monitoring/prometheus/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'easymo-production'
    environment: 'production'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']

# Load alert rules
rule_files:
  - 'alerts.yml'

# Scrape configurations
scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Node Exporter - Host metrics
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # Postgres Exporter
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  # Redis Exporter
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # Agent Core Service
  - job_name: 'agent-core'
    static_configs:
      - targets: ['agent-core:3000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  # Voice Bridge Service
  - job_name: 'voice-bridge'
    static_configs:
      - targets: ['voice-bridge:3001']
    metrics_path: '/metrics'

  # Wallet Service
  - job_name: 'wallet-service'
    static_configs:
      - targets: ['wallet-service:3002']
    metrics_path: '/metrics'

  # Ranking Service
  - job_name: 'ranking-service'
    static_configs:
      - targets: ['ranking-service:3003']
    metrics_path: '/metrics'

  # Vendor Service
  - job_name: 'vendor-service'
    static_configs:
      - targets: ['vendor-service:3004']
    metrics_path: '/metrics'

  # Buyer Service
  - job_name: 'buyer-service'
    static_configs:
      - targets: ['buyer-service:3005']
    metrics_path: '/metrics'

  # Notification Service
  - job_name: 'notification-service'
    static_configs:
      - targets: ['notification-service:3006']
    metrics_path: '/metrics'

  # All other microservices (add as needed)
  - job_name: 'microservices'
    static_configs:
      - targets:
          - 'message-service:3007'
          - 'insurance-service:3008'
          - 'simulator-service:3009'
          - 'analytics-service:3010'
          - 'support-service:3011'
    metrics_path: '/metrics'

  # Admin App (Next.js custom metrics endpoint)
  - job_name: 'admin-app'
    static_configs:
      - targets: ['admin-app:3000']
    metrics_path: '/api/metrics'
```

**3. Create Alert Rules**

File: `monitoring/prometheus/alerts.yml`

```yaml
groups:
  - name: service_health
    interval: 30s
    rules:
      # Service Down
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.job }} on {{ $labels.instance }} has been down for more than 1 minute."

      # High Error Rate
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ $labels.job }}"
          description: "{{ $labels.job }} has error rate of {{ $value }} errors/sec"

      # High Response Time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time on {{ $labels.job }}"
          description: "95th percentile response time is {{ $value }}s"

  - name: resource_usage
    interval: 30s
    rules:
      # High CPU Usage
      - alert: HighCPUUsage
        expr: process_cpu_seconds_total > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.job }}"
          description: "CPU usage is {{ $value }}%"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 / 1024 > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.job }}"
          description: "Memory usage is {{ $value }}GB"

      # Disk Space Low
      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Disk space low on {{ $labels.instance }}"
          description: "Only {{ $value }}% disk space remaining"

  - name: business_metrics
    interval: 1m
    rules:
      # Low Ride Acceptance Rate
      - alert: LowRideAcceptanceRate
        expr: rate(ride_requests_accepted_total[10m]) / rate(ride_requests_total[10m]) < 0.7
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low ride acceptance rate"
          description: "Acceptance rate is {{ $value }}%"

      # Payment Failures
      - alert: HighPaymentFailureRate
        expr: rate(payment_transactions_total{status="failed"}[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High payment failure rate"
          description: "Payment failure rate is {{ $value }}"

      # WhatsApp Message Delivery Issues
      - alert: WhatsAppDeliveryFailures
        expr: rate(whatsapp_messages_total{status="failed"}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "WhatsApp message delivery failures"
          description: "Failure rate is {{ $value }}"
```

**Success Criteria:**
- [ ] Docker compose stack starts successfully
- [ ] Prometheus UI accessible at http://localhost:9090
- [ ] Grafana UI accessible at http://localhost:3001
- [ ] All exporters showing as UP in Prometheus targets

---

#### Task 1.2: Configure Loki for Log Aggregation
**Owner:** DevOps  
**Time:** 2 hours  

File: `monitoring/loki/loki-config.yml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 5m
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/index
    cache_location: /loki/index_cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20

chunk_store_config:
  max_look_back_period: 720h  # 30 days

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h  # 30 days
```

File: `monitoring/promtail/promtail-config.yml`

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # Docker containers
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_log_stream']
        target_label: 'stream'
      - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
        target_label: 'service'
    pipeline_stages:
      - json:
          expressions:
            level: level
            msg: msg
            timestamp: time
            service: service
            trace_id: trace_id
      - labels:
          level:
          service:
          trace_id:
      - timestamp:
          source: timestamp
          format: RFC3339

  # System logs
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          __path__: /var/log/*.log
```

---

### Week 1: Days 3-4 (Wed-Thu: Dec 4-5)

#### Task 2.1: Instrument Microservices with Prometheus Metrics
**Owner:** Backend Team  
**Time:** 8 hours  

**1. Update @easymo/commons Package**

File: `packages/commons/src/monitoring/prometheus.ts`

```typescript
import promClient from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Create a Registry to register metrics
export const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
});

// HTTP Request Duration Histogram
export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// HTTP Request Counter
export const httpRequestCounter = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
  registers: [register],
});

// Active Requests Gauge
export const activeRequests = new promClient.Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  labelNames: ['service'],
  registers: [register],
});

// Business Metrics

// Ride Requests
export const rideRequests = new promClient.Counter({
  name: 'ride_requests_total',
  help: 'Total number of ride requests',
  labelNames: ['status', 'service_type'],
  registers: [register],
});

export const rideRequestsAccepted = new promClient.Counter({
  name: 'ride_requests_accepted_total',
  help: 'Total number of accepted ride requests',
  labelNames: ['service_type'],
  registers: [register],
});

export const rideDuration = new promClient.Histogram({
  name: 'ride_duration_seconds',
  help: 'Duration of completed rides',
  labelNames: ['service_type'],
  buckets: [60, 300, 600, 1200, 1800, 3600],
  registers: [register],
});

// Payment Metrics
export const paymentTransactions = new promClient.Counter({
  name: 'payment_transactions_total',
  help: 'Total payment transactions',
  labelNames: ['status', 'payment_method'],
  registers: [register],
});

export const paymentAmount = new promClient.Histogram({
  name: 'payment_amount_usd',
  help: 'Payment transaction amounts',
  labelNames: ['payment_method'],
  buckets: [1, 5, 10, 20, 50, 100, 200, 500],
  registers: [register],
});

// WhatsApp Metrics
export const whatsappMessages = new promClient.Counter({
  name: 'whatsapp_messages_total',
  help: 'Total WhatsApp messages',
  labelNames: ['status', 'message_type'],
  registers: [register],
});

// Database Connection Pool
export const dbConnections = new promClient.Gauge({
  name: 'db_connections_active',
  help: 'Active database connections',
  labelNames: ['database', 'service'],
  registers: [register],
});

export const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2],
  registers: [register],
});

// Middleware to track HTTP metrics
export function prometheusMiddleware(serviceName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    activeRequests.inc({ service: serviceName });

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;
      const statusCode = res.statusCode.toString();

      httpRequestDuration.observe(
        { method: req.method, route, status_code: statusCode, service: serviceName },
        duration
      );

      httpRequestCounter.inc({
        method: req.method,
        route,
        status_code: statusCode,
        service: serviceName,
      });

      activeRequests.dec({ service: serviceName });
    });

    next();
  };
}

// Metrics endpoint handler
export function metricsHandler() {
  return async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  };
}
```

**2. Update Package Exports**

File: `packages/commons/src/index.ts`

```typescript
// Add to existing exports
export * from './monitoring/prometheus';
export { register, metricsHandler, prometheusMiddleware } from './monitoring/prometheus';
```

**3. Instrument Agent Core Service**

File: `services/agent-core/src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { childLogger } from '@easymo/commons';
import { register, metricsHandler, prometheusMiddleware } from '@easymo/commons';

const log = childLogger({ service: 'agent-core' });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Add Prometheus middleware
  app.use(prometheusMiddleware('agent-core'));

  // Metrics endpoint
  app.getHttpAdapter().get('/metrics', metricsHandler());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  log.info({ event: 'SERVICE_STARTED', port }, 'Agent Core Service started');
}

bootstrap();
```

**4. Repeat for All Services**

Apply same pattern to:
- ✅ services/voice-bridge/src/server.ts
- ✅ services/wallet-service/src/main.ts
- ✅ services/ranking-service/src/main.ts
- ✅ services/vendor-service/src/main.ts
- ✅ services/buyer-service/src/main.ts
- ✅ services/notification-service/src/main.ts
- ✅ services/message-service/src/main.ts
- ✅ services/insurance-service/src/main.ts
- ✅ services/simulator-service/src/main.ts
- ✅ services/analytics-service/src/main.ts
- ✅ services/support-service/src/main.ts

---

#### Task 2.2: Add Business Metrics Tracking
**Owner:** Backend Team  
**Time:** 4 hours  

**Example: Track Ride Request Metrics**

File: `services/agent-core/src/rides/rides.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { childLogger, rideRequests, rideRequestsAccepted, rideDuration } from '@easymo/commons';

@Injectable()
export class RidesService {
  private readonly log = childLogger({ service: 'agent-core', module: 'RidesService' });

  async createRideRequest(dto: CreateRideRequestDto) {
    this.log.info({ event: 'RIDE_REQUEST_CREATED', dto }, 'New ride request');
    
    // Increment counter
    rideRequests.inc({ status: 'pending', service_type: dto.serviceType });

    try {
      const ride = await this.ridesRepository.create(dto);
      return ride;
    } catch (error) {
      rideRequests.inc({ status: 'failed', service_type: dto.serviceType });
      throw error;
    }
  }

  async acceptRideRequest(rideId: string, driverId: string) {
    this.log.info({ event: 'RIDE_ACCEPTED', rideId, driverId }, 'Ride accepted');
    
    const ride = await this.ridesRepository.findById(rideId);
    
    // Track acceptance
    rideRequestsAccepted.inc({ service_type: ride.serviceType });
    
    await this.ridesRepository.update(rideId, {
      status: 'accepted',
      driverId,
      acceptedAt: new Date(),
    });
  }

  async completeRide(rideId: string) {
    const ride = await this.ridesRepository.findById(rideId);
    const duration = (Date.now() - ride.acceptedAt.getTime()) / 1000;
    
    // Track duration
    rideDuration.observe({ service_type: ride.serviceType }, duration);
    
    this.log.info({ event: 'RIDE_COMPLETED', rideId, duration }, 'Ride completed');
    
    await this.ridesRepository.update(rideId, {
      status: 'completed',
      completedAt: new Date(),
    });
  }
}
```

---

### Week 1: Day 5 (Fri: Dec 6)

#### Task 3.1: Create Grafana Dashboards
**Owner:** DevOps + Backend  
**Time:** 6 hours  

**1. Provision Data Sources**

File: `monitoring/grafana/provisioning/datasources/datasources.yml`

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: false

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    editable: false
```

**2. System Overview Dashboard**

File: `monitoring/grafana/dashboards/system-overview.json`

```json
{
  "dashboard": {
    "title": "EasyMO - System Overview",
    "tags": ["easymo", "overview"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Service Health Status",
        "type": "stat",
        "targets": [
          {
            "expr": "up",
            "legendFormat": "{{ job }}"
          }
        ],
        "gridPos": { "x": 0, "y": 0, "w": 12, "h": 4 }
      },
      {
        "id": 2,
        "title": "Total Requests (Last Hour)",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{ service }}"
          }
        ],
        "gridPos": { "x": 12, "y": 0, "w": 12, "h": 8 }
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) by (service)",
            "legendFormat": "{{ service }}"
          }
        ],
        "gridPos": { "x": 0, "y": 8, "w": 12, "h": 8 }
      },
      {
        "id": 4,
        "title": "Response Time (P95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{ service }}"
          }
        ],
        "gridPos": { "x": 12, "y": 8, "w": 12, "h": 8 }
      }
    ]
  }
}
```

**3. Business Metrics Dashboard**

File: `monitoring/grafana/dashboards/business-metrics.json`

```json
{
  "dashboard": {
    "title": "EasyMO - Business Metrics",
    "tags": ["easymo", "business"],
    "panels": [
      {
        "id": 1,
        "title": "Ride Requests (Last Hour)",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(increase(ride_requests_total[1h]))"
          }
        ]
      },
      {
        "id": 2,
        "title": "Acceptance Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "sum(rate(ride_requests_accepted_total[10m])) / sum(rate(ride_requests_total[10m])) * 100"
          }
        ]
      },
      {
        "id": 3,
        "title": "Payment Success Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(payment_transactions_total{status=\"success\"}[5m])) / sum(rate(payment_transactions_total[5m])) * 100"
          }
        ]
      },
      {
        "id": 4,
        "title": "Active Rides",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(ride_requests_total{status=\"in_progress\"})"
          }
        ]
      }
    ]
  }
}
```

**4. Provision Dashboards**

File: `monitoring/grafana/provisioning/dashboards/dashboards.yml`

```yaml
apiVersion: 1

providers:
  - name: 'EasyMO Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
```

---

#### Task 3.2: Configure Alertmanager
**Owner:** DevOps  
**Time:** 2 hours  

File: `monitoring/alertmanager/alertmanager.yml`

```yaml
global:
  smtp_smarthost: 'smtp.sendgrid.net:587'
  smtp_from: 'alerts@easymo.dev'
  smtp_auth_username: 'apikey'
  smtp_auth_password: '${SENDGRID_API_KEY}'

route:
  receiver: 'default'
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  
  routes:
    # Critical alerts go to on-call team + email
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true
    
    # Warning alerts go to email only
    - match:
        severity: warning
      receiver: 'warning-alerts'

receivers:
  - name: 'default'
    email_configs:
      - to: 'devops@easymo.dev'

  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@easymo.dev'
        headers:
          Subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
    
    # Slack webhook (optional)
    slack_configs:
      - api_url: '${SLACK_WEBHOOK_URL}'
        channel: '#alerts-critical'
        title: '🚨 Critical Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}\n{{ end }}'

  - name: 'warning-alerts'
    email_configs:
      - to: 'devops@easymo.dev'
        headers:
          Subject: '[WARNING] {{ .GroupLabels.alertname }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'service']
```

---

## 🧪 TESTING & VALIDATION

### Test Plan

**1. Infrastructure Tests**
```bash
# Start monitoring stack
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# Verify all services are up
docker-compose -f docker-compose.monitoring.yml ps

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# Check Grafana health
curl http://localhost:3001/api/health

# Query Loki
curl -G -s "http://localhost:3100/loki/api/v1/query" --data-urlencode 'query={job="docker"}'
```

**2. Metrics Tests**
```bash
# Build and restart services with metrics
pnpm --filter @easymo/commons build
pnpm --filter @easymo/agent-core build
docker-compose up -d agent-core

# Check metrics endpoint
curl http://localhost:3000/metrics

# Verify metrics in Prometheus
curl 'http://localhost:9090/api/v1/query?query=http_requests_total'
```

**3. Alert Tests**
```bash
# Trigger test alert by stopping a service
docker stop easymo-agent-core

# Wait 1 minute
sleep 60

# Check pending alerts
curl http://localhost:9090/api/v1/alerts

# Restart service
docker start easymo-agent-core
```

**4. Dashboard Tests**
1. Open Grafana at http://localhost:3001
2. Login with admin / (password from env)
3. Navigate to Dashboards → EasyMO - System Overview
4. Verify all panels load data
5. Test time range selectors
6. Test dashboard variables

---

## 📊 SUCCESS METRICS

### Deployment Metrics
- [ ] All 12 microservices exposing `/metrics` endpoint
- [ ] Prometheus scraping all targets successfully (0 errors)
- [ ] Grafana showing data from all services
- [ ] Loki ingesting logs from all containers
- [ ] 95%+ uptime for monitoring stack

### Performance Metrics
- [ ] Prometheus query response time <500ms
- [ ] Grafana dashboard load time <3s
- [ ] Log ingestion lag <10s
- [ ] Alert evaluation interval <30s

### Business Metrics
- [ ] Ride request rate tracked
- [ ] Payment success rate tracked
- [ ] WhatsApp delivery rate tracked
- [ ] User signup rate tracked
- [ ] Revenue metrics tracked

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Review Grafana admin password security
- [ ] Configure SMTP settings for alerts
- [ ] Setup Slack webhook for critical alerts
- [ ] Document access procedures
- [ ] Train team on dashboard usage

### Deployment Steps
1. [ ] Create `monitoring/` directory structure
2. [ ] Copy all configuration files
3. [ ] Set environment variables
4. [ ] Build @easymo/commons package
5. [ ] Rebuild all microservices
6. [ ] Start monitoring stack
7. [ ] Verify all targets are UP
8. [ ] Import Grafana dashboards
9. [ ] Test alert firing
10. [ ] Document in production runbook

### Post-Deployment
- [ ] Monitor metrics collection for 24 hours
- [ ] Verify alert emails/Slack messages received
- [ ] Add monitoring URLs to team wiki
- [ ] Schedule weekly dashboard review
- [ ] Plan capacity upgrades based on metrics

---

## 🔐 SECURITY CONSIDERATIONS

### Access Control
- Grafana: Admin password required
- Prometheus: Restrict to internal network only
- Alertmanager: Authenticate SMTP
- No public exposure of metrics endpoints

### Data Retention
- Prometheus: 30 days
- Loki: 30 days
- Tempo: 7 days (traces are large)
- Regular cleanup of old data

### Secrets Management
- Store in environment variables
- Never commit to git
- Use GitHub Secrets for CI/CD
- Rotate credentials quarterly

---

## 📝 DOCUMENTATION UPDATES

### Files to Update
1. **README.md** - Add monitoring section
2. **DEPLOYMENT.md** - Add monitoring deployment steps
3. **GROUND_RULES.md** - Add observability requirements
4. **Service READMEs** - Document metrics endpoints

### Runbook Entries
1. "How to check service health"
2. "How to query logs in Loki"
3. "How to create custom dashboards"
4. "How to silence alerts"
5. "Troubleshooting missing metrics"

---

## ✅ PHASE 4 COMPLETION CRITERIA

### Must Have
- [x] Prometheus collecting metrics from all services
- [x] Grafana dashboards deployed
- [x] Loki aggregating logs
- [x] Alertmanager sending notifications
- [x] All services instrumented
- [x] Documentation updated

### Nice to Have
- [ ] Tempo distributed tracing fully implemented
- [ ] SLO/SLI dashboards
- [ ] Anomaly detection alerts
- [ ] Custom business dashboards per team
- [ ] Mobile app for alerts

---

## 🎯 NEXT STEPS (Phase 5)

After completing observability infrastructure:
1. Implement distributed tracing with OpenTelemetry
2. Add SLO/SLI tracking
3. Implement anomaly detection
4. Create incident response automation
5. Build predictive alerting

---

**Status:** Ready for Implementation  
**Start Date:** 2025-12-02  
**Target Completion:** 2025-12-06  
**Owner:** DevOps Team + Backend Team  

