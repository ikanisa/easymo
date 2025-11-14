# Monitoring and Observability Setup Guide

## Overview

This guide provides step-by-step instructions for setting up comprehensive monitoring and observability for the EasyMO platform using industry-standard tools.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Applications                        │
│  (Services, Edge Functions, Admin Panel)            │
└───────────┬─────────────────────┬───────────────────┘
            │                     │
            │ Logs                │ Metrics
            ▼                     ▼
    ┌───────────────┐     ┌───────────────┐
    │  Loki/ELK     │     │  Prometheus   │
    │  Log Storage  │     │  Time Series  │
    └───────┬───────┘     └───────┬───────┘
            │                     │
            └──────────┬──────────┘
                       ▼
              ┌────────────────┐
              │    Grafana     │
              │  Visualization │
              └────────────────┘
```

## Table of Contents

1. [Structured Logging](#structured-logging)
2. [Metrics Collection](#metrics-collection)
3. [Distributed Tracing](#distributed-tracing)
4. [Alerting](#alerting)
5. [Dashboards](#dashboards)
6. [Error Tracking](#error-tracking)

---

## Structured Logging

### Implementation

Already implemented in the platform! See:
- **Edge Functions:** `supabase/functions/_shared/observability.ts`
- **Node Services:** `packages/commons/src/logger.ts`

### Best Practices

```typescript
import { logger } from "@easymo/commons";

// ✅ DO: Use structured logging
logger.info({
  event: "PAYMENT_PROCESSED",
  userId: "user_123",
  amount: 1000,
  currency: "USD",
  transactionId: "tx_456",
  correlationId: req.headers["x-correlation-id"],
}, "Payment processed successfully");

// ❌ DON'T: Use unstructured strings
logger.info("Payment processed for user user_123 amount 1000");
```

### Log Aggregation Setup

#### Option 1: Grafana Loki (Recommended)

**Install Loki:**
```bash
# Docker Compose
cat > docker-compose.loki.yml << EOF
version: "3"
services:
  loki:
    image: grafana/loki:2.9.0
    ports:
      - "3100:3100"
    volumes:
      - ./loki-config.yaml:/etc/loki/local-config.yaml
      - loki-data:/loki
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:2.9.0
    volumes:
      - /var/log:/var/log
      - ./promtail-config.yaml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml

volumes:
  loki-data:
EOF

docker-compose -f docker-compose.loki.yml up -d
```

**Loki Configuration:** `loki-config.yaml`
```yaml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

**Promtail Configuration:** `promtail-config.yaml`
```yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: services
    static_configs:
      - targets:
          - localhost
        labels:
          job: easymo-services
          __path__: /var/log/easymo/*.log

  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
```

#### Option 2: ELK Stack

**Docker Compose:**
```yaml
version: "3"
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - es-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    ports:
      - "5044:5044"
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    ports:
      - "5601:5601"
    environment:
      ELASTICSEARCH_URL: http://elasticsearch:9200

volumes:
  es-data:
```

---

## Metrics Collection

### Prometheus Setup

**Install Prometheus:**
```bash
# Docker Compose
cat > docker-compose.prometheus.yml << EOF
version: "3"
services:
  prometheus:
    image: prom/prometheus:v2.48.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'

volumes:
  prometheus-data:
EOF
```

**Prometheus Configuration:** `prometheus.yml`
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'easymo-production'

scrape_configs:
  # Wallet Service
  - job_name: 'wallet-service'
    static_configs:
      - targets: ['localhost:4400']
    metrics_path: '/metrics'

  # Ranking Service
  - job_name: 'ranking-service'
    static_configs:
      - targets: ['localhost:4401']

  # Vendor Service
  - job_name: 'vendor-service'
    static_configs:
      - targets: ['localhost:4402']

  # Agent Core
  - job_name: 'agent-core'
    static_configs:
      - targets: ['localhost:4404']

  # Node Exporter (system metrics)
  - job_name: 'node'
    static_configs:
      - targets: ['localhost:9100']

  # PostgreSQL
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']

  # Redis
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']

rule_files:
  - 'alerts.yml'
```

### Service Metrics Implementation

**Add Prometheus client to services:**

```typescript
// services/wallet-service/src/metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Request counter
export const requestCounter = new Counter({
  name: 'wallet_requests_total',
  help: 'Total number of requests',
  labelNames: ['method', 'endpoint', 'status'],
});

// Request duration
export const requestDuration = new Histogram({
  name: 'wallet_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Transfer counter
export const transferCounter = new Counter({
  name: 'wallet_transfers_total',
  help: 'Total number of transfers',
  labelNames: ['status', 'currency'],
});

// Account balance gauge
export const accountBalance = new Gauge({
  name: 'wallet_account_balance',
  help: 'Current account balance',
  labelNames: ['accountId', 'currency'],
});

// Export metrics endpoint
export function metricsHandler(req: any, res: any) {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
}
```

**Add to Express app:**
```typescript
import { metricsHandler, requestCounter, requestDuration } from './metrics';

// Metrics endpoint
app.get('/metrics', metricsHandler);

// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    requestCounter.inc({
      method: req.method,
      endpoint: req.route?.path || req.path,
      status: res.statusCode,
    });
    
    requestDuration.observe({
      method: req.method,
      endpoint: req.route?.path || req.path,
    }, duration);
  });
  
  next();
});
```

---

## Distributed Tracing

### OpenTelemetry Setup

**Install dependencies:**
```bash
pnpm add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

**Configure tracing:**
```typescript
// services/wallet-service/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  serviceName: 'wallet-service',
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error));
});
```

**Start Jaeger (trace collector):**
```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

---

## Alerting

### Alert Rules

**File:** `prometheus/alerts.yml`
```yaml
groups:
  - name: easymo_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: rate(wallet_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate is {{ $value }} errors/second"

      # Service down
      - alert: ServiceDown
        expr: up{job=~".*-service"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"

      # High response time
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(wallet_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time on {{ $labels.service }}"
          description: "95th percentile is {{ $value }} seconds"

      # Database connection pool exhausted
      - alert: ConnectionPoolExhausted
        expr: db_connections_active / db_connections_max > 0.9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Database connection pool nearly exhausted"

      # High memory usage
      - alert: HighMemoryUsage
        expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"

      # Disk space running out
      - alert: DiskSpaceRunningOut
        expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) < 0.1
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "Disk space running out on {{ $labels.instance }}"

      # WhatsApp webhook worker dependency failure
      - alert: WhatsAppWebhookWorkerDependenciesDegraded
        expr: probe_success{job="whatsapp-webhook-worker-health"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "WhatsApp webhook worker dependency probe failing"
          description: |
            Synthetic health check reported degraded status.
            Latest failure reason: {{ $labels.failure_reason }}
```

### AlertManager Setup

**Configuration:** `alertmanager.yml`
```yaml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@easymo.com'
  smtp_auth_username: 'alerts@easymo.com'
  smtp_auth_password: 'app_password'

route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'team-email'
  routes:
    - match:
        severity: critical
      receiver: 'pagerduty'

receivers:
  - name: 'team-email'
    email_configs:
      - to: 'team@easymo.com'

  - name: 'pagerduty'
    pagerduty_configs:
      - service_key: 'your_pagerduty_key'

  - name: 'slack'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

---

### Synthetic WhatsApp Worker Probe

- **Script:** `tools/monitoring/whatsapp/worker-health-check.ts`
- **Schedule:** Every minute via Cron, GitHub Actions, or your synthetic monitor platform.
- **Export to Prometheus:** Push `probe_success` (1/0) and `failure_reason` label via Pushgateway or
  your preferred metrics bridge so the `WhatsAppWebhookWorkerDependenciesDegraded` rule can evaluate accurately.

Example Cron entry using Pushgateway:

```bash
* * * * * WHATSAPP_WORKER_HEALTH_URL=https://worker.easymo.com/health \
    deno run --allow-env --allow-net tools/monitoring/whatsapp/worker-health-check.ts \
    | curl --silent --show-error --data-binary @- \
        http://pushgateway.easymo.com:9091/metrics/job/whatsapp-webhook-worker-health
```

The script surfaces Redis, Supabase, and OpenAI probe results (including upstream HTTP status codes)
so operators can triage the failing dependency immediately.

---

## Dashboards

### Grafana Setup

**Install Grafana:**
```bash
docker run -d --name grafana \
  -p 3000:3000 \
  -v grafana-storage:/var/lib/grafana \
  grafana/grafana:latest
```

**Access:** http://localhost:3000 (admin/admin)

### Pre-built Dashboards

Create `dashboards/wallet-service.json`:
```json
{
  "dashboard": {
    "title": "Wallet Service Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(wallet_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(wallet_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "Errors"
          }
        ]
      },
      {
        "title": "Response Time (p95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(wallet_request_duration_seconds_bucket[5m]))",
            "legendFormat": "p95"
          }
        ]
      },
      {
        "title": "Active Transfers",
        "targets": [
          {
            "expr": "wallet_transfers_total",
            "legendFormat": "{{status}}"
          }
        ]
      }
    ]
  }
}
```

### Import Dashboard

```bash
# Via API
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -d @dashboards/wallet-service.json
```

---

## Error Tracking

### Sentry Setup

**Install:**
```bash
pnpm add @sentry/node @sentry/profiling-node
```

**Configure:**
```typescript
// services/wallet-service/src/sentry.ts
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  integrations: [
    new ProfilingIntegration(),
  ],
});

// Export for use in error handlers
export { Sentry };
```

**Add to Express:**
```typescript
import { Sentry } from './sentry';

// Request handler (must be first)
app.use(Sentry.Handlers.requestHandler());

// Tracing handler
app.use(Sentry.Handlers.tracingHandler());

// Your routes here
app.post('/wallet/transfer', ...);

// Error handler (must be last)
app.use(Sentry.Handlers.errorHandler());
```

---

## Quick Start Checklist

- [ ] Set up log aggregation (Loki or ELK)
- [ ] Configure Prometheus scraping
- [ ] Add metrics endpoints to all services
- [ ] Set up Grafana dashboards
- [ ] Configure AlertManager
- [ ] Set up Sentry for error tracking
- [ ] Configure distributed tracing (optional)
- [ ] Test alerting with sample issues
- [ ] Document runbooks for common alerts
- [ ] Train team on monitoring tools

---

**Last Updated:** 2024-03-15  
**Version:** 1.0  
**Owner:** DevOps Team
