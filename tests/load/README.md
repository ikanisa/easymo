# Mobility V2 Load Testing

## Prerequisites

```bash
# Install k6
brew install k6

# Or using Docker
docker pull grafana/k6
```

## Running Tests

### Basic Load Test
```bash
cd tests/load
k6 run mobility-load-test.js
```

### With Environment Variables
```bash
k6 run \
  -e ORCHESTRATOR_URL=http://localhost:4600 \
  -e SUPABASE_URL=http://localhost:54321 \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  mobility-load-test.js
```

### Stress Test (Higher Load)
```bash
k6 run --vus 2000 --duration 10m mobility-load-test.js
```

### Smoke Test (Quick Validation)
```bash
k6 run --vus 10 --duration 1m mobility-load-test.js
```

## Test Scenarios

### Scenario 1: Gradual Ramp-up (Default)
- Ramp to 100 users over 2 minutes
- Maintain 100 users for 5 minutes
- Ramp to 500 users over 2 minutes
- Maintain 500 users for 5 minutes
- Ramp to 1000 users over 2 minutes
- Maintain 1000 users for 5 minutes
- Ramp down over 3 minutes

**Total Duration**: ~24 minutes

### Scenario 2: Spike Test
```bash
k6 run --stage 0s:0,1s:1000,5m:1000,1s:0 mobility-load-test.js
```

### Scenario 3: Soak Test (Endurance)
```bash
k6 run --vus 500 --duration 1h mobility-load-test.js
```

## Metrics Tracked

- **HTTP request duration** (p50, p95, p99)
- **Error rate** (should be < 1%)
- **Cache hit rate** (should be > 50%)
- **Drivers found per search**
- **Match creation duration**
- **Total requests processed**

## Success Criteria

| Metric | Target | Critical |
|--------|--------|----------|
| p95 latency | < 1s | < 2s |
| Error rate | < 0.1% | < 1% |
| Cache hit rate | > 70% | > 50% |
| Throughput | > 500 req/s | > 200 req/s |

## Results Analysis

Results are saved to `load-test-results.json` after each run.

```bash
# View results
cat load-test-results.json | jq '.metrics'

# Compare runs
diff load-test-results-1.json load-test-results-2.json
```

## Monitoring During Load Test

### Prometheus Queries
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m])

# p95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Cache hit rate
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

### Grafana Dashboard
Open `http://localhost:3000` and select "Mobility V2 - Overview"

## Troubleshooting

### High Error Rate
- Check service logs: `docker logs orchestrator`
- Check database connections
- Verify Redis is running

### Low Cache Hit Rate
- Check Redis connection
- Verify cache TTL settings
- Review cache invalidation logic

### Slow Response Times
- Check database query performance
- Review service-to-service latency
- Verify resource limits (CPU/memory)

## Cleanup

```bash
# Remove test data
psql $DATABASE_URL -c "DELETE FROM mobility_trips WHERE creator_user_id = '00000000-0000-0000-0000-000000000001';"
psql $DATABASE_URL -c "DELETE FROM mobility_trip_matches WHERE passenger_user_id = '00000000-0000-0000-0000-000000000001';"

# Flush Redis cache
redis-cli FLUSHDB
```
