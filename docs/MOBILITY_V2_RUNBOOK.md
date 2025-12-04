# Mobility V2 Operations Runbook

**Version**: 2.0.0  
**Last Updated**: December 4, 2025  
**On-Call**: #mobility-oncall

---

## Quick Reference

### Service URLs
- Orchestrator: http://localhost:4600
- Matching: http://localhost:4700
- Ranking: http://localhost:4500
- Tracking: http://localhost:4800
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000

### Common Commands
```bash
# View service status
docker-compose -f docker-compose.mobility.yml ps

# View logs
docker-compose -f docker-compose.mobility.yml logs -f [service-name]

# Restart service
docker-compose -f docker-compose.mobility.yml restart [service-name]

# Check health
curl http://localhost:4600/health

# View metrics
curl http://localhost:4600/metrics
```

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P0 | Complete outage | 15 min | All services down |
| P1 | Major degradation | 30 min | Error rate > 10% |
| P2 | Minor degradation | 2 hours | Slow responses |
| P3 | Monitoring alert | 1 day | Cache hit rate low |

---

## Common Issues

### Issue 1: High Error Rate (P1)

**Symptoms**:
- Alert: "HighErrorRate" firing
- Error rate > 5% in Grafana
- User reports of failed matches

**Investigation**:
```bash
# Check service health
curl http://localhost:4600/health

# Check error logs
docker logs orchestrator --tail=100 | grep ERROR

# Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# Check Redis
docker exec redis-mobility redis-cli ping
```

**Common Causes**:
1. Database connection pool exhausted
2. Redis down
3. Downstream service timeout
4. Invalid data in requests

**Resolution**:

```bash
# Option 1: Restart services
docker-compose -f docker-compose.mobility.yml restart

# Option 2: Scale down load
# Reduce traffic percentage in edge function

# Option 3: Check database connections
psql $DATABASE_URL -c "
  SELECT count(*) as connections, state 
  FROM pg_stat_activity 
  WHERE datname = current_database()
  GROUP BY state;
"

# Option 4: Clear Redis cache
docker exec redis-mobility redis-cli FLUSHDB
```

**Escalation**: If error rate > 10% for > 15 minutes, page on-call engineer.

---

### Issue 2: Slow Response Time (P2)

**Symptoms**:
- Alert: "SlowResponseTime" firing
- p95 latency > 1s
- User complaints about slow search

**Investigation**:
```bash
# Check response times
curl http://localhost:9090/api/v1/query?query='http_request_duration_seconds{quantile="0.95"}'

# Check database query performance
psql $DATABASE_URL -c "
  SELECT query, mean_exec_time, calls
  FROM pg_stat_statements
  ORDER BY mean_exec_time DESC
  LIMIT 10;
"

# Check Redis latency
docker exec redis-mobility redis-cli --latency
```

**Common Causes**:
1. Missing database indexes
2. Slow spatial queries
3. Redis cache misses
4. Too many drivers to rank

**Resolution**:

```bash
# Option 1: Analyze database queries
psql $DATABASE_URL -c "ANALYZE mobility_trips;"

# Option 2: Check index usage
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  WHERE tablename LIKE 'mobility_%'
  ORDER BY idx_scan;
"

# Option 3: Increase cache TTL
# Update cache-layer/src/cache.ts

# Option 4: Reduce search radius
# In orchestrator, reduce default radiusKm
```

**Escalation**: If p95 > 2s for > 30 minutes, escalate to platform team.

---

### Issue 3: No Drivers Found (P3)

**Symptoms**:
- Alert: "NoDriversFound" firing
- > 30% of searches return 0 drivers
- Users report "No drivers available"

**Investigation**:
```bash
# Check active driver trips
psql $DATABASE_URL -c "
  SELECT COUNT(*) 
  FROM mobility_trips 
  WHERE role = 'driver' 
    AND status = 'pending' 
    AND expires_at > NOW();
"

# Check spatial query
psql $DATABASE_URL -c "
  SELECT 
    COUNT(*) as drivers,
    vehicle_type
  FROM mobility_trips
  WHERE role = 'driver'
    AND status = 'pending'
  GROUP BY vehicle_type;
"

# Check matching service logs
docker logs matching-service --tail=100
```

**Common Causes**:
1. No active drivers
2. Search radius too small
3. Vehicle type mismatch
4. Expired trips not cleaned up

**Resolution**:

```bash
# Option 1: Increase search radius
# Update default radiusKm in orchestrator

# Option 2: Clean up expired trips
psql $DATABASE_URL -c "
  UPDATE mobility_trips 
  SET status = 'expired' 
  WHERE expires_at < NOW() 
    AND status = 'pending';
"

# Option 3: Check driver app
# Verify drivers can create trips
```

**Escalation**: If issue persists for > 4 hours, notify product team.

---

### Issue 4: Service Down (P0)

**Symptoms**:
- Alert: "ServiceDown" firing
- Service health check failing
- Container exited

**Investigation**:
```bash
# Check service status
docker ps -a | grep mobility

# Check service logs
docker logs [service-name] --tail=100

# Check resource usage
docker stats --no-stream
```

**Common Causes**:
1. Out of memory (OOM)
2. Uncaught exception
3. Port already in use
4. Missing environment variable

**Resolution**:

```bash
# Option 1: Restart service
docker-compose -f docker-compose.mobility.yml restart [service-name]

# Option 2: Check for OOM
docker inspect [service-name] | grep OOMKilled

# Option 3: Increase memory limit
# Edit docker-compose.mobility.yml

# Option 4: Check environment variables
docker exec [service-name] env | grep SUPABASE
```

**Escalation**: Immediate page for P0. Rollback if cannot resolve in 15 minutes.

---

### Issue 5: Cache Not Working (P3)

**Symptoms**:
- Cache hit rate < 50%
- All requests hitting database
- Slow performance

**Investigation**:
```bash
# Check Redis status
docker exec redis-mobility redis-cli INFO

# Check cache keys
docker exec redis-mobility redis-cli KEYS "mobility:*"

# Check cache TTL
docker exec redis-mobility redis-cli TTL "mobility:drivers:some-id"

# Check Redis memory
docker exec redis-mobility redis-cli INFO memory
```

**Common Causes**:
1. Redis down
2. Cache keys not being set
3. TTL too short
4. Cache being cleared too often

**Resolution**:

```bash
# Option 1: Restart Redis
docker-compose -f docker-compose.mobility.yml restart redis-mobility

# Option 2: Check Redis logs
docker logs redis-mobility --tail=100

# Option 3: Manually test cache
docker exec redis-mobility redis-cli SET test "value"
docker exec redis-mobility redis-cli GET test

# Option 4: Check service connection
docker exec orchestrator ping redis-mobility
```

**Escalation**: Non-critical, can wait until business hours.

---

## Deployment Procedures

### Normal Deployment

```bash
# 1. Pre-check
./scripts/deploy-mobility-v2.sh pre-check

# 2. Database migration
./scripts/deploy-mobility-v2.sh database

# 3. Deploy services
./scripts/deploy-mobility-v2.sh services

# 4. Gradual cutover
./scripts/deploy-mobility-v2.sh cutover-10  # Wait 24h
./scripts/deploy-mobility-v2.sh cutover-50  # Wait 24h
./scripts/deploy-mobility-v2.sh cutover-100 # Wait 48h

# 5. Cleanup
./scripts/deploy-mobility-v2.sh cleanup
```

### Emergency Rollback

```bash
# Immediate rollback
./scripts/deploy-mobility-v2.sh rollback

# Verify V1 working
curl https://api.example.com/mobility/nearby

# Check error rate
# Should drop to normal levels within 5 minutes
```

---

## Monitoring & Alerts

### Grafana Dashboards

1. **Mobility Overview**
   - URL: http://localhost:3000/d/mobility-overview
   - Shows: Request rate, latency, error rate, cache hits

2. **Service Health**
   - URL: http://localhost:3000/d/service-health
   - Shows: CPU, memory, uptime, health checks

3. **Database Performance**
   - URL: http://localhost:3000/d/database
   - Shows: Query duration, connection pool, slow queries

### Alert Channels

- PagerDuty: P0, P1 incidents
- Slack #mobility-alerts: All alerts
- Email: P3 alerts (daily digest)

### Alert Response

When you receive an alert:
1. Acknowledge in PagerDuty
2. Check Grafana dashboard
3. Review service logs
4. Follow runbook for specific alert
5. Update incident channel
6. Create post-mortem if P0/P1

---

## Maintenance

### Daily Tasks
- [ ] Review error logs
- [ ] Check cache hit rate
- [ ] Monitor disk space
- [ ] Review slow queries

### Weekly Tasks
- [ ] Analyze performance trends
- [ ] Review and tune indexes
- [ ] Clean up old trips
- [ ] Update runbook with new issues

### Monthly Tasks
- [ ] Review and update alerts
- [ ] Capacity planning
- [ ] Performance testing
- [ ] Security audit

---

## Database Maintenance

### Clean Up Expired Trips
```sql
-- Run daily
DELETE FROM mobility_trips
WHERE expires_at < NOW() - INTERVAL '7 days';

-- Vacuum
VACUUM ANALYZE mobility_trips;
```

### Optimize Indexes
```sql
-- Rebuild spatial index
REINDEX INDEX idx_mobility_trips_spatial;

-- Analyze table
ANALYZE mobility_trips;
```

### Check Database Size
```sql
SELECT 
  pg_size_pretty(pg_total_relation_size('mobility_trips')) as size,
  (SELECT count(*) FROM mobility_trips) as row_count;
```

---

## Performance Tuning

### Database Connection Pool
```typescript
// In orchestrator/src/index.ts
const supabase = createClient(url, key, {
  db: {
    pool: {
      max: 20,        // Increase if running out of connections
      min: 5,         // Minimum idle connections
      idleTimeoutMillis: 30000,
    }
  }
});
```

### Redis Memory
```bash
# Check memory usage
docker exec redis-mobility redis-cli INFO memory

# Set max memory
docker exec redis-mobility redis-cli CONFIG SET maxmemory 512mb

# Set eviction policy
docker exec redis-mobility redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Service Resources
```yaml
# In docker-compose.mobility.yml
deploy:
  resources:
    limits:
      cpus: '1'       # Increase for higher throughput
      memory: 512M    # Increase if OOM
```

---

## Troubleshooting Tools

### Useful Queries

```sql
-- Active trips by status
SELECT status, role, COUNT(*) 
FROM mobility_trips 
GROUP BY status, role;

-- Recent matches
SELECT * FROM mobility_trip_matches 
ORDER BY created_at DESC 
LIMIT 10;

-- Driver metrics summary
SELECT 
  AVG(rating) as avg_rating,
  AVG(acceptance_rate) as avg_acceptance,
  AVG(completion_rate) as avg_completion
FROM mobility_driver_metrics;

-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query LIKE '%mobility%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Useful Commands

```bash
# Check all service health
for port in 4500 4600 4700 4800; do
  echo "Port $port: $(curl -sf http://localhost:$port/health | jq -r .status)"
done

# Monitor logs in real-time
docker-compose -f docker-compose.mobility.yml logs -f --tail=100

# Check database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Redis info
docker exec redis-mobility redis-cli INFO stats

# Service resource usage
docker stats --no-stream | grep mobility
```

---

## Contacts

| Role | Contact | Hours |
|------|---------|-------|
| On-Call Engineer | PagerDuty | 24/7 |
| Platform Team | #platform | Business hours |
| Database Admin | #dba | Business hours |
| Product Owner | [email] | Business hours |

---

## Post-Mortem Template

```markdown
# Incident Post-Mortem

**Date**: YYYY-MM-DD
**Severity**: P0/P1/P2/P3
**Duration**: X hours
**Impact**: X users affected

## Summary
Brief description of what happened.

## Timeline
- HH:MM - First alert
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

## Root Cause
What caused the issue.

## Resolution
How it was fixed.

## Action Items
- [ ] Prevent recurrence
- [ ] Update monitoring
- [ ] Update runbook
- [ ] Improve alerts

## Lessons Learned
What we learned from this incident.
```

---

**Maintained by**: Platform Team  
**Review Schedule**: Monthly  
**Last Review**: December 4, 2025
