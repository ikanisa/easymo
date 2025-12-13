# EasyMO Backup and Disaster Recovery Procedures

## Overview

This document outlines the backup strategy, recovery procedures, and disaster recovery plan for the
EasyMO platform.

## Table of Contents

1. [Backup Strategy](#backup-strategy)
2. [Recovery Procedures](#recovery-procedures)
3. [Disaster Recovery Plan](#disaster-recovery-plan)
4. [Testing and Validation](#testing-and-validation)
5. [Runbooks](#runbooks)

---

## Backup Strategy

### Database Backups

#### Supabase (Primary Database)

**Automatic Backups:**

- Supabase Pro tier provides daily automated backups
- Point-in-time recovery (PITR) available for last 7 days
- Backups stored in multiple availability zones

**Manual Backups:**

```bash
# Export full database schema and data
supabase db dump --project-ref <project-ref> > backup_$(date +%Y%m%d_%H%M%S).sql

# Export specific tables
supabase db dump --project-ref <project-ref> \
  --table transactions \
  --table messages \
  --table users > critical_tables_backup.sql
```

**Backup Schedule:**

- Daily: Automated full backup (Supabase)
- Weekly: Manual backup of critical tables
- Monthly: Full backup stored in cold storage (S3 Glacier)

**Retention Policy:**

- Daily backups: 30 days
- Weekly backups: 3 months
- Monthly backups: 1 year
- Annual backups: 7 years (for financial data compliance)

#### Agent-Core Database (Prisma/PostgreSQL)

**Setup Automated Backups:**

```bash
# Install pg_dump automation
cat > /etc/cron.daily/agent-core-backup.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgres"
DATABASE_URL="your_database_url_here"

mkdir -p $BACKUP_DIR

# Dump database
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/agent_core_$TIMESTAMP.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "agent_core_*.sql.gz" -mtime +30 -delete

# Upload to S3
aws s3 cp $BACKUP_DIR/agent_core_$TIMESTAMP.sql.gz \
  s3://easymo-backups/agent-core/
EOF

chmod +x /etc/cron.daily/agent-core-backup.sh
```

### Application Backups

**Configuration Files:**

```bash
# Backup environment variables and configs
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
  .env.production \
  supabase/config.toml \
  docker-compose*.yml \
  services/*/Dockerfile

# Upload to S3
aws s3 cp config_backup_*.tar.gz s3://easymo-backups/configs/
```

**Edge Functions:**

```bash
# Backup all Supabase functions
tar -czf functions_backup_$(date +%Y%m%d).tar.gz supabase/functions/

# Upload to S3
aws s3 cp functions_backup_*.tar.gz s3://easymo-backups/functions/
```

### Redis Backup

**Setup Redis Persistence:**

```bash
# Configure Redis for AOF persistence
redis-cli CONFIG SET appendonly yes
redis-cli CONFIG SET appendfsync everysec

# Manual backup
redis-cli BGSAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /var/backups/redis/dump_$(date +%Y%m%d).rdb
```

### Kafka Backup

**Topic Configuration Backup:**

```bash
# Export topic configurations
kafka-topics.sh --bootstrap-server localhost:9092 --describe > kafka_topics_$(date +%Y%m%d).txt

# Backup important consumer offsets
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --all-groups --describe > kafka_offsets_$(date +%Y%m%d).txt
```

---

## Recovery Procedures

### Database Recovery

#### Full Database Restore (Supabase)

```bash
# 1. Create new Supabase project or use existing
# 2. Restore from backup file
psql $SUPABASE_DB_URL < backup_20240315_120000.sql

# 3. Verify data integrity
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM users;"
psql $SUPABASE_DB_URL -c "SELECT COUNT(*) FROM transactions;"

# 4. Run migrations if needed
supabase db push
```

#### Point-in-Time Recovery

```bash
# Restore to specific timestamp (Supabase dashboard)
# 1. Navigate to Database > Backups
# 2. Select restore point
# 3. Choose "Point in time recovery"
# 4. Enter timestamp: 2024-03-15 11:30:00 UTC
# 5. Confirm restore
```

#### Partial Table Recovery

```bash
# Restore specific table from backup
psql $SUPABASE_DB_URL << EOF
-- Drop corrupted table
DROP TABLE IF EXISTS transactions CASCADE;

-- Restore from backup
\i backup_transactions_only.sql

-- Verify
SELECT COUNT(*) FROM transactions;
SELECT MAX(created_at) FROM transactions;
EOF
```

### Application Recovery

#### Edge Functions Deployment

```bash
# Restore functions from backup
tar -xzf functions_backup_20240315.tar.gz

# Deploy all functions
supabase functions deploy admin-settings admin-stats admin-users admin-trips wa-webhook

# Verify deployment
curl -X GET https://your-project.supabase.co/functions/v1/admin-health \
  -H "x-api-key: $ADMIN_TOKEN"
```

#### Microservices Recovery

```bash
# Pull latest images
docker-compose -f docker-compose.agent-core.yml pull

# Start services
docker-compose -f docker-compose.agent-core.yml up -d

# Verify health
curl http://localhost:4400/health  # wallet-service
curl http://localhost:4401/health  # ranking-service
```

### Redis Recovery

```bash
# Stop Redis
systemctl stop redis

# Restore from backup
cp /var/backups/redis/dump_20240315.rdb /var/lib/redis/dump.rdb

# Start Redis
systemctl start redis

# Verify
redis-cli PING
redis-cli DBSIZE
```

---

## Disaster Recovery Plan

### Scenarios and Response

#### Scenario 1: Complete Database Loss

**Recovery Time Objective (RTO):** 4 hours  
**Recovery Point Objective (RPO):** 24 hours

**Steps:**

1. **Assess Damage** (15 minutes)
   - Determine extent of data loss
   - Identify last known good backup

2. **Provision New Database** (30 minutes)

   ```bash
   # Create new Supabase project
   # Or provision new PostgreSQL instance
   ```

3. **Restore from Backup** (2 hours)

   ```bash
   # Restore latest daily backup
   psql $NEW_DATABASE_URL < latest_backup.sql
   ```

4. **Verify Data Integrity** (1 hour)

   ```bash
   # Run verification queries
   ./scripts/verify-database-integrity.sh
   ```

5. **Update Connection Strings** (30 minutes)

   ```bash
   # Update all services with new DATABASE_URL
   # Redeploy edge functions
   ```

6. **Gradual Service Restoration** (1 hour)
   ```bash
   # Start read-only mode first
   # Verify with read queries
   # Enable writes
   # Monitor for issues
   ```

#### Scenario 2: Service Outage (Multiple Services Down)

**RTO:** 1 hour  
**RPO:** 5 minutes

**Steps:**

1. **Identify Failed Services** (5 minutes)

   ```bash
   # Check service health
   ./scripts/health-check-all.sh
   ```

2. **Check Infrastructure** (10 minutes)

   ```bash
   # Verify AWS/GCP status
   # Check DNS resolution
   # Verify network connectivity
   ```

3. **Restart Services** (15 minutes)

   ```bash
   # Restart Docker containers
   docker-compose restart

   # Or restart individual services
   systemctl restart wallet-service
   ```

4. **Verify Recovery** (15 minutes)

   ```bash
   # Run smoke tests
   pnpm test:smoke
   ```

5. **Monitor and Validate** (15 minutes)
   ```bash
   # Check logs for errors
   # Monitor metrics
   # Verify user traffic resuming
   ```

#### Scenario 3: Security Breach

**Immediate Actions:**

1. **Isolate Affected Systems** (Immediate)

   ```bash
   # Disable compromised API keys
   # Block suspicious IPs
   # Revoke access tokens
   ```

2. **Assess Impact** (30 minutes)

   ```bash
   # Check audit logs
   # Identify accessed data
   # Determine breach scope
   ```

3. **Rotate Credentials** (1 hour)

   ```bash
   # Rotate all API keys
   # Generate new service role keys
   # Update all services with new credentials
   ```

4. **Patch Vulnerabilities** (2-4 hours)

   ```bash
   # Deploy security patches
   # Update dependencies
   # Apply security fixes
   ```

5. **Monitor and Validate** (Ongoing)
   ```bash
   # Enhanced monitoring
   # Review all access patterns
   # Implement additional security controls
   ```

---

## Testing and Validation

### Backup Testing Schedule

**Monthly:** Restore test in staging environment

```bash
# Restore latest backup to staging
./scripts/restore-to-staging.sh

# Run integration tests
pnpm test:integration

# Validate data integrity
./scripts/verify-staging-data.sh
```

**Quarterly:** Full disaster recovery drill

```bash
# Simulate complete system failure
# Follow full DR procedures
# Document time taken for each step
# Identify improvements
```

### Validation Checklist

After any restoration:

- [ ] Database accessible and responding
- [ ] All tables present with expected row counts
- [ ] Foreign key constraints intact
- [ ] Indexes created and optimized
- [ ] RLS policies active
- [ ] Edge functions deployed and accessible
- [ ] Microservices healthy and responding
- [ ] Redis cache operational
- [ ] Kafka topics accessible
- [ ] All API endpoints responding correctly
- [ ] Critical workflows functioning (payments, messaging, etc.)
- [ ] Monitoring and alerting active

---

## Runbooks

### Quick Reference: Database Restore

```bash
# 1. Download latest backup
aws s3 cp s3://easymo-backups/daily/latest.sql.gz .

# 2. Decompress
gunzip latest.sql.gz

# 3. Restore
psql $DATABASE_URL < latest.sql

# 4. Verify
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

### Quick Reference: Service Restart

```bash
# All services
docker-compose -f docker-compose.agent-core.yml restart

# Individual service
docker-compose -f docker-compose.agent-core.yml restart wallet-service

# Check logs
docker-compose -f docker-compose.agent-core.yml logs -f wallet-service
```

### Quick Reference: Rollback Deployment

```bash
# Rollback edge functions
supabase functions deploy admin-stats --version previous

# Rollback microservice
docker-compose -f docker-compose.agent-core.yml pull wallet-service:1.2.3
docker-compose -f docker-compose.agent-core.yml up -d wallet-service

# Rollback database migration
psql $DATABASE_URL < migrations/rollback/20240315_rollback.sql
```

---

## Contacts and Escalation

### On-Call Rotation

**Primary:** DevOps Engineer (on-call schedule)  
**Secondary:** Backend Lead  
**Escalation:** CTO

### External Contacts

**Supabase Support:** support@supabase.com  
**AWS Support:** (for infrastructure issues)  
**Twilio Support:** (for SMS/voice issues)

### Communication Channels

**Incident Channel:** #incidents (Slack)  
**Status Page:** status.easymo.com  
**Customer Support:** support@easymo.com

---

## Continuous Improvement

### Post-Incident Review

After each incident:

1. Document what happened
2. Analyze root cause
3. Identify preventive measures
4. Update runbooks and procedures
5. Schedule follow-up actions

### Backup Validation Metrics

Track and improve:

- Time to restore (RTO)
- Data loss (RPO)
- Success rate of restores
- Time to detect issues
- Mean time to recovery (MTTR)

### Regular Updates

- Review and update this document quarterly
- Update runbooks after each incident
- Test and validate all procedures regularly
- Train team members on DR procedures

---

## Automation Scripts

### Backup Automation

Create `/scripts/backup-automation.sh`:

```bash
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/var/backups/easymo"
S3_BUCKET="s3://easymo-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Database backup
echo "Backing up Supabase database..."
supabase db dump --project-ref $SUPABASE_PROJECT_REF > $BACKUP_DIR/db_$TIMESTAMP.sql

# Compress
gzip $BACKUP_DIR/db_$TIMESTAMP.sql

# Upload to S3
aws s3 cp $BACKUP_DIR/db_$TIMESTAMP.sql.gz $S3_BUCKET/daily/

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

# Verify backup
aws s3 ls $S3_BUCKET/daily/db_$TIMESTAMP.sql.gz

echo "Backup completed successfully"
```

### Restore Automation

Create `/scripts/restore-automation.sh`:

```bash
#!/bin/bash
set -e

# Usage: ./restore-automation.sh <backup-file>

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

# Download from S3 if needed
if [[ $BACKUP_FILE == s3://* ]]; then
  echo "Downloading from S3..."
  LOCAL_FILE="/tmp/restore_$(date +%Y%m%d_%H%M%S).sql.gz"
  aws s3 cp $BACKUP_FILE $LOCAL_FILE
  BACKUP_FILE=$LOCAL_FILE
fi

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  echo "Decompressing..."
  gunzip -c $BACKUP_FILE > /tmp/restore.sql
  BACKUP_FILE=/tmp/restore.sql
fi

# Restore
echo "Restoring database..."
psql $DATABASE_URL < $BACKUP_FILE

# Verify
echo "Verifying restore..."
psql $DATABASE_URL -c "SELECT COUNT(*) as user_count FROM users;"

echo "Restore completed successfully"
```

Make scripts executable:

```bash
chmod +x /scripts/backup-automation.sh
chmod +x /scripts/restore-automation.sh
```

---

**Last Updated:** 2024-03-15  
**Version:** 1.0  
**Owner:** DevOps Team
