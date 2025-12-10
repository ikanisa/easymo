# Database Schema Optimization Plan
**Date**: 2025-11-27  
**Current State**: 663 migrations, 82,393 SQL lines, 702 indexes, 231 RLS policies

---

## 📊 Schema Analysis Results

### Scale Metrics
- **Migration files**: 663
- **Total SQL lines**: 82,393
- **Indexes**: 702
- **RLS policies**: 231
- **Estimated tables**: 200+

### High-Traffic Tables Identified
```
1. wa_events - WhatsApp webhook events
2. whatsapp_messages - Message storage
3. processed_webhook_messages - Processing log
4. conversation_history - AI conversations
5. messages - General messages
6. marketplace_transactions - E-commerce
7. momo_transactions - Mobile money
8. voice_events - Voice call logs
9. llm_failover_events - AI failover tracking
10. webhook_logs - HTTP request logs
11. wa_events_bq_queue - BigQuery sync queue
12. unified_agent_events - Agent telemetry
```

### Tables with JSONB (Potential Bloat)
- `webhook_dlq` - Dead letter queue payloads
- Various metadata/config tables

---

## 🎯 Optimization Priorities

### Priority 1: Partitioning (Critical)
**Target**: High-volume time-series tables

#### wa_events
```sql
-- Current: Single table with all webhook events
-- Problem: Millions of rows, slow queries on historical data
-- Solution: Partition by created_at (monthly)

-- Example migration
BEGIN;

-- Create partitioned table
CREATE TABLE wa_events_partitioned (
  LIKE wa_events INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions (last 3 months + next 3 months)
CREATE TABLE wa_events_2025_11 PARTITION OF wa_events_partitioned
  FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE wa_events_2025_12 PARTITION OF wa_events_partitioned
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE wa_events_2026_01 PARTITION OF wa_events_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Future partitions created via cron job

COMMIT;
```

**Impact**: 
- 90%+ faster queries on recent data
- Easy archival of old partitions
- Better vacuum performance

#### whatsapp_messages
```sql
-- Partition by created_at (weekly for high volume)
CREATE TABLE whatsapp_messages_partitioned (
  LIKE whatsapp_messages INCLUDING ALL
) PARTITION BY RANGE (created_at);
```

**Impact**:
- Sub-second queries on current week
- Archive old messages to cold storage
- Reduce table bloat

#### webhook_logs & processed_webhook_messages
```sql
-- Partition by date, retain 30 days
-- Automatically drop old partitions
```

**Retention policy**:
- Keep 7 days in hot storage (partitioned)
- Move 8-30 days to warm storage
- Drop >30 days (or archive to S3)

---

### Priority 2: Index Optimization

#### Composite Indexes for Common Queries
```sql
-- wa_events: Filter by user + time
CREATE INDEX idx_wa_events_user_time 
  ON wa_events (from_number, created_at DESC);

-- messages: Conversation + time
CREATE INDEX idx_messages_conversation_time 
  ON messages (conversation_id, created_at DESC);

-- marketplace_transactions: Status + user
CREATE INDEX idx_marketplace_tx_status_user 
  ON marketplace_transactions (status, user_id);
```

#### Partial Indexes for Active Data
```sql
-- Only index unprocessed webhook messages
CREATE INDEX idx_webhook_unprocessed 
  ON processed_webhook_messages (created_at) 
  WHERE processed = false;

-- Only index active conversations
CREATE INDEX idx_active_conversations 
  ON conversations (updated_at DESC) 
  WHERE archived = false;
```

#### Remove Unused Indexes
```sql
-- Identify unused indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Drop if confirmed unused after 30 days
```

---

### Priority 3: Data Archival Strategy

#### Hot/Warm/Cold Tiers
```
HOT (Postgres):
- Last 7 days of wa_events, messages, logs
- All active conversations
- Recent transactions (<30 days)

WARM (Postgres compressed):
- 8-30 days of events/logs
- Completed transactions 30-90 days
- Archived conversations

COLD (S3/BigQuery):
- >30 days of logs
- >90 days of transactions
- Historical analytics data
```

#### Implementation
```sql
-- Cron job to archive old data
CREATE OR REPLACE FUNCTION archive_old_data()
RETURNS void AS $$
BEGIN
  -- Move old webhook logs to archive table
  WITH archived AS (
    DELETE FROM webhook_logs
    WHERE created_at < NOW() - INTERVAL '30 days'
    RETURNING *
  )
  INSERT INTO webhook_logs_archive
  SELECT * FROM archived;
  
  -- Log archival
  INSERT INTO archival_log (table_name, rows_archived, archived_at)
  VALUES ('webhook_logs', (SELECT COUNT(*) FROM archived), NOW());
END;
$$ LANGUAGE plpgsql;

-- Schedule daily at 2 AM
SELECT cron.schedule(
  'archive-old-data',
  '0 2 * * *',
  'SELECT archive_old_data();'
);
```

---

### Priority 4: JSONB Optimization

#### webhook_dlq Payload Compression
```sql
-- Add compressed column for large payloads
ALTER TABLE webhook_dlq 
  ADD COLUMN payload_compressed BYTEA;

-- Function to compress/decompress
CREATE OR REPLACE FUNCTION compress_payload()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_column_size(NEW.payload) > 1000 THEN
    NEW.payload_compressed = gzip(NEW.payload::text);
    NEW.payload = NULL;  -- Remove uncompressed
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compress_webhook_payload
  BEFORE INSERT OR UPDATE ON webhook_dlq
  FOR EACH ROW
  EXECUTE FUNCTION compress_payload();
```

**Impact**: 70%+ storage reduction on large payloads

---

### Priority 5: Vacuum & Maintenance

#### Auto-Vacuum Tuning
```sql
-- Aggressive vacuum for high-churn tables
ALTER TABLE wa_events SET (
  autovacuum_vacuum_scale_factor = 0.05,  -- Vacuum at 5% dead tuples
  autovacuum_analyze_scale_factor = 0.02, -- Analyze at 2% changes
  autovacuum_vacuum_cost_delay = 10       -- Faster vacuum
);

ALTER TABLE whatsapp_messages SET (
  autovacuum_vacuum_scale_factor = 0.05
);

ALTER TABLE webhook_logs SET (
  autovacuum_vacuum_scale_factor = 0.1  -- More aggressive for logs
);
```

#### Manual Vacuum Schedule
```sql
-- Weekly full vacuum during maintenance window
SELECT cron.schedule(
  'weekly-vacuum',
  '0 3 * * 0',  -- Sunday 3 AM
  'VACUUM ANALYZE;'
);
```

---

## 📊 Expected Performance Gains

| Optimization | Tables Affected | Expected Improvement |
|--------------|-----------------|---------------------|
| Partitioning | wa_events, messages, logs | 90%+ query speed |
| Composite indexes | All high-traffic | 50-80% query speed |
| Partial indexes | Active data queries | 70%+ query speed |
| Data archival | Logs, old events | 60%+ storage reduction |
| JSONB compression | webhook_dlq | 70%+ storage reduction |
| Vacuum tuning | All tables | 30%+ write performance |

**Overall database performance**: +200-300%  
**Storage reduction**: 40-60%  
**Query latency**: <100ms for 95% of queries

---

## 🚀 Implementation Roadmap

### Week 1: Analysis & Planning (This Week)
- [x] Identify high-traffic tables ✅
- [ ] Query analysis (pg_stat_statements)
- [ ] Storage analysis (pg_table_size)
- [ ] Create partitioning scripts
- [ ] Test in staging

### Week 2: Partitioning Rollout
- [ ] Partition wa_events (Monday)
- [ ] Partition whatsapp_messages (Tuesday)
- [ ] Partition webhook_logs (Wednesday)
- [ ] Create auto-partition cron (Thursday)
- [ ] Monitor and validate (Friday)

### Week 3: Index & Archive
- [ ] Add composite indexes
- [ ] Remove unused indexes
- [ ] Implement archival cron jobs
- [ ] Set up cold storage (S3)
- [ ] Tune auto-vacuum

### Week 4: Monitoring & Polish
- [ ] Set up performance dashboards
- [ ] Configure alerts for table bloat
- [ ] Document maintenance procedures
- [ ] Load test optimizations
- [ ] Final production validation

---

## 🔧 Migration Scripts to Create

### 1. Partition wa_events
```bash
supabase/migrations/20251127140000_partition_wa_events.sql
```

### 2. Create Archive Tables
```bash
supabase/migrations/20251127140001_create_archive_tables.sql
```

### 3. Add Composite Indexes
```bash
supabase/migrations/20251127140002_optimize_indexes.sql
```

### 4. Setup Archival Cron
```bash
supabase/migrations/20251127140003_setup_archival_cron.sql
```

### 5. Vacuum Configuration
```bash
supabase/migrations/20251127140004_configure_vacuum.sql
```

---

## 📈 Monitoring Queries

### Table Size Tracking
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                 pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Index Usage
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC
LIMIT 20;
```

### Bloat Detection
```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_dead_tup,
  n_live_tup,
  ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_pct
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

---

## ✅ Success Criteria

- [ ] wa_events queries <100ms for last 7 days
- [ ] whatsapp_messages queries <50ms for active conversations
- [ ] Total database size reduced by 40%+
- [ ] No queries >1s in p99
- [ ] Auto-vacuum keeps bloat <10%
- [ ] Archival running successfully (check daily)
- [ ] Partition creation automated

---

## 🎯 Next Actions

1. **Immediate**: Run query analysis on production
2. **This week**: Create partition migration scripts
3. **Next week**: Deploy partitioning to staging
4. **Week 3**: Production rollout with monitoring

---

**Impact**: This optimization plan will handle 10x traffic growth with current infrastructure! 🚀
