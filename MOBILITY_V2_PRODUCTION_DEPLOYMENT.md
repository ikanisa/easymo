# Mobility V2 - Production Deployment Guide

**Version**: 2.0.0  
**Date**: December 4, 2025  
**Status**: Ready for Production Deployment

---

## Overview

This guide covers the complete production deployment of Mobility V2 microservices architecture.

---

## Pre-Deployment Checklist

### Infrastructure
- [ ] Kubernetes cluster ready (or Docker Swarm)
- [ ] PostgreSQL 15+ with PostGIS 3.3+
- [ ] Redis 7+ cluster
- [ ] Load balancer configured
- [ ] SSL certificates ready
- [ ] DNS records configured

### Services
- [ ] matching-service built and tested
- [ ] ranking-service built and tested
- [ ] orchestrator built and tested
- [ ] tracking-service built and tested
- [ ] cache-layer tested

### Database
- [ ] V2 schema migrations applied
- [ ] Indexes created and analyzed
- [ ] RLS policies tested
- [ ] Backup strategy in place

### Monitoring
- [ ] Prometheus deployed
- [ ] Grafana dashboards imported
- [ ] Alert rules configured
- [ ] PagerDuty/Slack integration

### Testing
- [ ] 29 tests passing (12 unit + 17 integration)
- [ ] Load test passed (1000 concurrent users)
- [ ] Smoke tests passed
- [ ] Security audit completed

---

## Deployment Phases

### Phase 1: Infrastructure Setup (Day 1)

#### 1.1 Deploy Redis Cluster
```bash
# Using Docker
docker run -d \
  --name redis-mobility \
  --network mobility-net \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes

# Or using Kubernetes
kubectl apply -f infrastructure/k8s/redis-deployment.yml
```

#### 1.2 Deploy Prometheus
```bash
docker run -d \
  --name prometheus \
  --network mobility-net \
  -p 9090:9090 \
  -v $(pwd)/infrastructure/monitoring/prometheus:/etc/prometheus \
  prom/prometheus:latest \
  --config.file=/etc/prometheus/prometheus.yml
```

#### 1.3 Deploy Grafana
```bash
docker run -d \
  --name grafana \
  --network mobility-net \
  -p 3000:3000 \
  -v grafana-data:/var/lib/grafana \
  grafana/grafana:latest
```

---

### Phase 2: Database Migration (Day 2)

#### 2.1 Apply V2 Schema
```bash
# Apply migrations
supabase db push

# Verify
psql $DATABASE_URL -c "SELECT * FROM mobility_trips LIMIT 1;"
```

#### 2.2 Enable Dual-Write
```bash
# Apply dual-write trigger
psql $DATABASE_URL -f supabase/migrations/20251205100000_dual_write_setup.sql

# Monitor write latency
```

#### 2.3 Backfill Historical Data
```bash
# Run backfill script
export DATABASE_URL="postgresql://..."
export BATCH_SIZE=5000
export START_DATE="2024-01-01"

./scripts/migration/backfill-v2.sh
```

#### 2.4 Verify Data Consistency
```bash
# Compare counts
psql $DATABASE_URL -c "
SELECT
  'V1' as version, COUNT(*) FROM mobility_intents
UNION ALL
SELECT
  'V2' as version, COUNT(*) FROM mobility_trips;
"
```

---

### Phase 3: Service Deployment (Day 3)

#### 3.1 Deploy Services
```bash
# Build images
docker build -t mobility-matching:2.0.0 services/matching-service
docker build -t mobility-ranking:2.0.0 services/ranking-service
docker build -t mobility-orchestrator:2.0.0 services/mobility-orchestrator
docker build -t mobility-tracking:2.0.0 services/tracking-service

# Push to registry
docker tag mobility-matching:2.0.0 registry.example.com/mobility-matching:2.0.0
docker push registry.example.com/mobility-matching:2.0.0
# ... repeat for all services

# Deploy
docker-compose -f docker-compose.production.yml up -d
```

#### 3.2 Verify Service Health
```bash
# Check all services
curl http://matching-service:4700/health
curl http://ranking-service:4500/health
curl http://orchestrator:4600/health
curl http://tracking-service:4800/health

# Check metrics
curl http://orchestrator:4600/metrics | grep http_requests_total
```

---

### Phase 4: Traffic Cutover (Day 4-7)

#### 4.1 Deploy Edge Function V2
```bash
# Deploy new edge function
supabase functions deploy wa-webhook-mobility

# Verify deployment
supabase functions list
```

#### 4.2 Gradual Traffic Shift

**Day 4: 10% Traffic**
```typescript
// In wa-webhook-mobility/index.ts
const USE_V2 = Math.random() < 0.10; // 10%

if (USE_V2) {
  return handleNearbyV2(payload);
} else {
  return handleNearby(payload); // Old version
}
```

Monitor metrics for 24 hours.

**Day 5: 50% Traffic**
```typescript
const USE_V2 = Math.random() < 0.50; // 50%
```

Monitor for 24 hours.

**Day 6: 100% Traffic**
```typescript
const USE_V2 = true; // 100%
```

Monitor for 48 hours.

**Day 7: Remove Old Code**
```bash
# Delete old handler
rm supabase/functions/wa-webhook-mobility/handlers/nearby.ts

# Keep only nearby_v2.ts
```

---

## Rollback Procedures

### Immediate Rollback (< 1 hour)
```bash
# 1. Switch traffic back to V1
# In edge function:
const USE_V2 = false;

# 2. Redeploy
supabase functions deploy wa-webhook-mobility
```

### Database Rollback
```bash
# 1. Disable dual-write trigger
psql $DATABASE_URL -c "DROP TRIGGER mobility_dual_write_trigger ON mobility_intents;"

# 2. Continue using V1 schema
# V2 data remains for retry later
```

### Service Rollback
```bash
# Stop V2 services
docker-compose down

# V1 continues running (no changes)
```

---

## Monitoring & Alerts

### Key Metrics to Watch

| Metric | Normal | Warning | Critical |
|--------|--------|---------|----------|
| Error rate | < 0.1% | 0.1-1% | > 1% |
| p95 latency | < 500ms | 500ms-1s | > 1s |
| Cache hit rate | > 70% | 50-70% | < 50% |
| Service uptime | 100% | 99.9% | < 99.9% |

### Grafana Dashboards
1. **Mobility Overview** - Request rates, latency, errors
2. **Cache Performance** - Hit rate, Redis metrics
3. **Database** - Query duration, connection pool
4. **Services** - CPU, memory, network

### Alerts
- ServiceDown (2min downtime)
- HighErrorRate (> 5% for 5min)
- SlowResponseTime (p95 > 1s for 5min)
- LowCacheHitRate (< 50% for 10min)

---

## Performance Tuning

### Database
```sql
-- Analyze tables after migration
ANALYZE mobility_trips;
ANALYZE mobility_trip_matches;
ANALYZE mobility_driver_metrics;

-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'mobility_%'
ORDER BY idx_scan;
```

### Redis
```bash
# Set maxmemory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Monitor memory
redis-cli INFO memory
```

### Connection Pools
```typescript
// orchestrator/src/index.ts
const supabase = createClient(url, key, {
  db: {
    pool: {
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
    }
  }
});
```

---

## Security

### Environment Variables
```bash
# Production secrets (use vault/secrets manager)
export SUPABASE_SERVICE_ROLE_KEY="..."
export REDIS_PASSWORD="..."
export DATABASE_URL="postgresql://..."
export MOBILITY_ORCHESTRATOR_URL="https://orchestrator.internal"
```

### Network Policies
```yaml
# Allow only internal traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: mobility-services
spec:
  podSelector:
    matchLabels:
      app: mobility
  policyTypes:
    - Ingress
  ingress:
    - from:
      - podSelector:
          matchLabels:
            app: edge-functions
```

---

## Post-Deployment

### Day 1 After Cutover
- [ ] Monitor error rates hourly
- [ ] Check cache hit rate
- [ ] Verify data consistency
- [ ] Review performance metrics

### Week 1
- [ ] Daily performance review
- [ ] Database query optimization
- [ ] Cache tuning
- [ ] User feedback analysis

### Week 2
- [ ] Load testing in production
- [ ] Fine-tune connection pools
- [ ] Optimize indexes
- [ ] Document lessons learned

### Week 4
- [ ] Delete V1 schema (if stable)
- [ ] Archive migration scripts
- [ ] Update runbooks
- [ ] Celebrate! 🎉

---

## Support Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | #mobility-oncall | PagerDuty |
| Database Admin | #dba-team | - |
| DevOps | #devops | - |
| Product Owner | - | Email |

---

## Appendix

### A. Environment Variables Reference
See `services/*/README.md` for each service

### B. API Endpoints
See `MOBILITY_V2_WEEK1_FINAL_SUMMARY.md`

### C. Database Schema
See `supabase/migrations/20251204180000_mobility_v2_complete_schema.sql`

### D. Troubleshooting
See `docs/TROUBLESHOOTING.md`

---

**Deployment Owner**: DevOps Team  
**Deployment Date**: TBD  
**Estimated Duration**: 7 days  
**Risk Level**: Medium

