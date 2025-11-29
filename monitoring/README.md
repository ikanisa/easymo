# EasyMO Observability Infrastructure

Comprehensive monitoring stack for all EasyMO microservices using Prometheus, Grafana, Loki, and Tempo.

## 📊 Stack Overview

| Component | Purpose | Port | URL |
|-----------|---------|------|-----|
| **Prometheus** | Metrics collection & storage | 9090 | http://localhost:9090 |
| **Grafana** | Visualization & dashboards | 3001 | http://localhost:3001 |
| **Loki** | Log aggregation | 3100 | http://localhost:3100 |
| **Tempo** | Distributed tracing | 3200 | http://localhost:3200 |
| **Alertmanager** | Alert routing & notification | 9093 | http://localhost:9093 |
| **Node Exporter** | Host metrics | 9100 | - |
| **Postgres Exporter** | Database metrics | 9187 | - |
| **Redis Exporter** | Cache metrics | 9121 | - |

## 🚀 Quick Start

### 1. Set Environment Variables

```bash
# Create .env file in monitoring directory
cat > monitoring/.env <<EOF
# Grafana
GRAFANA_ADMIN_PASSWORD=your-secure-password

# Database connection (Agent Core)
AGENT_CORE_DATABASE_URL=postgresql://postgres:password@postgres:5432/easymo

# Redis connection
REDIS_URL=redis://redis:6379

# Email alerts (SendGrid)
SENDGRID_API_KEY=your-sendgrid-api-key

# Slack alerts (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
EOF
```

### 2. Start Monitoring Stack

```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### 3. Verify Services

```bash
# Check all services are running
docker-compose -f docker-compose.monitoring.yml ps

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job, health}'

# Access Grafana
open http://localhost:3001
# Login: admin / <GRAFANA_ADMIN_PASSWORD>
```

## 📈 Instrumentation Guide

### For NestJS Services

```typescript
// main.ts
import { createMetricsRegistry, createBusinessMetrics, metricsMiddleware, metricsHandler } from '@easymo/commons';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Create metrics registry
  const metrics = createMetricsRegistry('agent-core');
  const businessMetrics = createBusinessMetrics(metrics);

  // Add metrics middleware
  app.use(metricsMiddleware(metrics));

  // Expose metrics endpoint
  app.getHttpAdapter().get('/metrics', metricsHandler(metrics));

  // Make available globally
  app.set('metrics', metrics);
  app.set('businessMetrics', businessMetrics);

  await app.listen(3000);
}
```

### For Express Services

```typescript
// server.ts
import express from 'express';
import { createMetricsRegistry, createBusinessMetrics, metricsMiddleware, metricsHandler } from '@easymo/commons';

const app = express();

// Create metrics
const metrics = createMetricsRegistry('voice-bridge');
const businessMetrics = createBusinessMetrics(metrics);

// Add metrics middleware
app.use(metricsMiddleware(metrics));

// Expose metrics endpoint
app.get('/metrics', metricsHandler(metrics));

app.listen(3001);
```

### Track Business Metrics

```typescript
import { BusinessMetrics } from '@easymo/commons';

// In your service
export class RidesService {
  constructor(private businessMetrics: BusinessMetrics) {}

  async createRide(dto: CreateRideDto) {
    // Track ride request
    this.businessMetrics.trackRideRequest(dto.serviceType, 'pending');

    const ride = await this.ridesRepository.create(dto);
    return ride;
  }

  async acceptRide(rideId: string) {
    const ride = await this.ridesRepository.findById(rideId);
    
    // Track acceptance
    this.businessMetrics.trackRideAcceptance(ride.serviceType);
    
    await this.ridesRepository.update(rideId, { status: 'accepted' });
  }

  async completeRide(rideId: string) {
    const ride = await this.ridesRepository.findById(rideId);
    const duration = (Date.now() - ride.acceptedAt.getTime()) / 1000;
    
    // Track completion
    this.businessMetrics.trackRideCompletion(ride.serviceType, duration);
    
    await this.ridesRepository.update(rideId, { status: 'completed' });
  }
}
```

### Payment Tracking

```typescript
async processPayment(amount: number, paymentMethod: string) {
  try {
    await this.paymentGateway.charge(amount, paymentMethod);
    
    this.businessMetrics.trackPayment(paymentMethod, amount, 'success');
  } catch (error) {
    this.businessMetrics.trackPayment(paymentMethod, amount, 'failed', error.code);
    throw error;
  }
}
```

### WhatsApp Tracking

```typescript
async sendWhatsAppMessage(to: string, message: string) {
  try {
    await this.whatsappClient.send(to, message);
    
    this.businessMetrics.trackWhatsAppMessage('text', 'sent');
  } catch (error) {
    this.businessMetrics.trackWhatsAppMessage('text', 'failed', error.code);
    throw error;
  }
}
```

### Database Query Tracking

```typescript
async findUserById(userId: string) {
  const start = Date.now();
  
  try {
    const user = await this.usersRepository.findById(userId);
    const duration = (Date.now() - start) / 1000;
    
    this.businessMetrics.trackDatabaseQuery('SELECT', 'users', duration);
    
    return user;
  } catch (error) {
    const duration = (Date.now() - start) / 1000;
    this.businessMetrics.trackDatabaseQuery('SELECT', 'users', duration, true);
    throw error;
  }
}
```

## 📊 Available Dashboards

### 1. System Overview
- Service health status
- Request rate per service
- Error rates
- Response time percentiles (P50, P95, P99)
- Resource usage (CPU, Memory)

### 2. Business Metrics (TODO - Create dashboard)
- Ride request rate
- Ride acceptance rate
- Active rides
- Payment success rate
- Revenue metrics
- WhatsApp delivery rate

### 3. Infrastructure (TODO - Create dashboard)
- Host metrics (CPU, Memory, Disk)
- Database connections
- Redis performance
- Network I/O

## 🔔 Alerting

### Pre-configured Alerts

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| ServiceDown | Service down > 1min | Critical | Page on-call |
| HighErrorRate | 5xx errors > 5% | Warning | Email DevOps |
| HighResponseTime | P95 > 1s | Warning | Email DevOps |
| DiskSpaceLow | < 10% free | Critical | Page on-call |
| HighPaymentFailureRate | > 10% | Critical | Page on-call |
| LowRideAcceptanceRate | < 70% | Warning | Email Product |

### Test Alerts

```bash
# Stop a service to trigger ServiceDown alert
docker stop easymo-agent-core

# Wait 1 minute for alert to fire
sleep 60

# Check Prometheus alerts
curl http://localhost:9090/api/v1/alerts

# Check Alertmanager
curl http://localhost:9093/api/v2/alerts

# Restart service
docker start easymo-agent-core
```

## 🔍 Querying Metrics

### Prometheus Query Examples

```promql
# Request rate per service
sum(rate(http_requests_total[5m])) by (service)

# Error rate
sum(rate(http_requests_total{status_code=~"5.."}[5m])) by (service)

# P95 response time
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Active rides
sum(active_rides) by (service_type)

# Payment success rate
sum(rate(payment_transactions_total{status="success"}[5m])) / 
sum(rate(payment_transactions_total[5m])) * 100

# Database connections
sum(db_connections_active) by (database)
```

### Loki Log Query Examples

```logql
# All logs from agent-core
{service="agent-core"}

# Error logs only
{service="agent-core"} | json | level="error"

# Logs for specific trace
{service="agent-core"} | json | trace_id="abc123"

# Payment failures
{service="wallet-service"} | json | event="PAYMENT_FAILED"

# WhatsApp webhook errors
{service="wa-webhook"} | json | level="error"
```

## 🛠️ Maintenance

### Data Retention

- **Prometheus**: 30 days
- **Loki**: 30 days
- **Tempo**: 7 days (traces are large)

### Backup

```bash
# Backup Prometheus data
docker run --rm -v prometheus_data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz /data

# Backup Grafana dashboards
docker exec easymo-grafana grafana-cli admin export-dashboard > dashboards-backup.json
```

### Cleanup Old Data

```bash
# Prometheus cleanup (automatic via retention policy)

# Loki cleanup
curl -X POST http://localhost:3100/loki/api/v1/delete?query={job="old-job"}&start=2024-01-01T00:00:00Z&end=2024-06-01T00:00:00Z
```

## 🔐 Security

### Access Control

- Grafana requires authentication (admin user)
- Prometheus exposed only to internal network
- Metrics endpoints require service network access
- No public exposure of monitoring stack

### Secrets Management

Never commit these to git:
- `GRAFANA_ADMIN_PASSWORD`
- `SENDGRID_API_KEY`
- `SLACK_WEBHOOK_URL`
- Database credentials

Store in environment variables or secrets manager.

## 🐛 Troubleshooting

### Service not showing metrics

```bash
# Check if service exposes /metrics
curl http://localhost:3000/metrics

# Check if Prometheus can scrape
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.job=="agent-core")'

# Check service logs
docker logs easymo-agent-core
```

### Prometheus target down

```bash
# Check network connectivity
docker exec easymo-prometheus curl http://agent-core:3000/metrics

# Verify service is in correct Docker network
docker network inspect easymo
```

### Missing logs in Loki

```bash
# Check Promtail is running
docker logs easymo-promtail

# Verify log format
docker logs easymo-agent-core --tail 10

# Query Loki directly
curl -G -s "http://localhost:3100/loki/api/v1/query" --data-urlencode 'query={job="docker"}'
```

### Grafana dashboard shows no data

1. Check data source connection (Settings → Data Sources)
2. Verify time range is correct
3. Check Prometheus has data: `curl http://localhost:9090/api/v1/query?query=up`
4. Inspect browser console for errors

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [Tempo Documentation](https://grafana.com/docs/tempo/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)

## 🤝 Contributing

To add new metrics:

1. Add metric definition to `packages/commons/src/business-metrics.ts`
2. Update service to track the metric
3. Build commons: `pnpm --filter @easymo/commons build`
4. Rebuild service
5. Create/update Grafana dashboard
6. Add alert rule if needed
7. Document in this README

## 📞 Support

For issues with monitoring:
- Slack: #observability
- Email: devops@easymo.dev
- On-call: See PagerDuty schedule
