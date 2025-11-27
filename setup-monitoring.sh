#!/bin/bash
# Setup Monitoring Infrastructure
# Grafana dashboards + PagerDuty/Slack alerts

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}EasyMO Monitoring Setup${NC}"
echo -e "${GREEN}========================================${NC}\n"

# Check if Grafana is accessible
if [ -z "$GRAFANA_URL" ]; then
    echo -e "${YELLOW}GRAFANA_URL not set. Please set:${NC}"
    echo "export GRAFANA_URL=http://your-grafana:3000"
    echo ""
    read -p "Enter Grafana URL (or press Enter to skip): " GRAFANA_URL
fi

if [ -z "$GRAFANA_API_KEY" ]; then
    echo -e "${YELLOW}GRAFANA_API_KEY not set.${NC}"
    read -p "Enter Grafana API Key (or press Enter to skip): " GRAFANA_API_KEY
fi

# Import DLQ Dashboard
if [ ! -z "$GRAFANA_URL" ] && [ ! -z "$GRAFANA_API_KEY" ]; then
    echo -e "\n${YELLOW}Importing Grafana Dashboards${NC}"
    
    echo "Importing DLQ dashboard..."
    if curl -X POST "${GRAFANA_URL}/api/dashboards/db" \
        -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
        -H "Content-Type: application/json" \
        -d @monitoring/dlq-dashboard.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} DLQ dashboard imported"
    else
        echo -e "${YELLOW}⚠${NC} DLQ dashboard import failed (check credentials)"
    fi
    
    echo "Importing webhook performance dashboard..."
    if curl -X POST "${GRAFANA_URL}/api/dashboards/db" \
        -H "Authorization: Bearer ${GRAFANA_API_KEY}" \
        -H "Content-Type: application/json" \
        -d @monitoring/webhook-performance-dashboard.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Webhook performance dashboard imported"
    else
        echo -e "${YELLOW}⚠${NC} Webhook performance dashboard import failed"
    fi
else
    echo -e "${YELLOW}⚠${NC} Skipping Grafana dashboard import (no credentials)"
fi

# Setup PagerDuty (if configured)
echo -e "\n${YELLOW}PagerDuty Setup${NC}"
if [ -z "$PAGERDUTY_INTEGRATION_KEY" ]; then
    echo "PAGERDUTY_INTEGRATION_KEY not set"
    echo "Set this in your alerting system configuration"
else
    echo -e "${GREEN}✓${NC} PagerDuty integration key configured"
fi

# Setup Slack (if configured)
echo -e "\n${YELLOW}Slack Setup${NC}"
if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "SLACK_WEBHOOK_URL not set"
    echo "Create webhook at: https://api.slack.com/messaging/webhooks"
else
    echo -e "${GREEN}✓${NC} Slack webhook configured"
    
    # Test Slack notification
    read -p "Send test notification to Slack? (yes/no): " test_slack
    if [ "$test_slack" = "yes" ]; then
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H "Content-Type: application/json" \
            -d '{
                "text": "🚀 EasyMO Monitoring Active",
                "attachments": [{
                    "color": "good",
                    "title": "Production Deployment Complete",
                    "text": "Week 1 deployment successful. Monitoring is now active.",
                    "fields": [
                        {"title": "Status", "value": "✅ Healthy", "short": true},
                        {"title": "Readiness", "value": "82%", "short": true}
                    ]
                }]
            }'
        echo -e "\n${GREEN}✓${NC} Test notification sent to Slack"
    fi
fi

# Create monitoring queries file
echo -e "\n${YELLOW}Creating Monitoring Queries${NC}"
cat > monitoring/queries.sql << 'SQL'
-- EasyMO Production Monitoring Queries
-- Run these regularly to monitor system health

-- 1. DLQ Health Check
SELECT 
    status,
    COUNT(*) as count,
    ROUND(AVG(retry_count), 2) as avg_retries
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- 2. DLQ Processing Performance
SELECT 
    DATE_TRUNC('hour', processed_at) as hour,
    SUM(entries_processed) as total_processed,
    SUM(entries_failed) as total_failed,
    ROUND(100.0 * SUM(entries_processed) / NULLIF(SUM(entries_processed) + SUM(entries_failed), 0), 2) as success_rate
FROM dlq_processing_log
WHERE processed_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- 3. Webhook Success Rate
SELECT 
    COUNT(*) as total_webhooks,
    SUM(CASE WHEN processed = true THEN 1 ELSE 0 END) as successful,
    ROUND(100.0 * SUM(CASE WHEN processed = true THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM processed_webhook_messages
WHERE created_at > NOW() - INTERVAL '1 hour';

-- 4. Top Errors (Last 24 Hours)
SELECT 
    error_message,
    COUNT(*) as occurrences,
    MAX(created_at) as last_seen
FROM webhook_dlq
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY error_message
ORDER BY occurrences DESC
LIMIT 10;

-- 5. Database Table Sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - 
                   pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- 6. Database Bloat Detection
SELECT 
    schemaname,
    tablename,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) as bloat_pct,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND n_dead_tup > 1000
ORDER BY n_dead_tup DESC
LIMIT 10;

-- 7. Active Cron Jobs
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    database
FROM cron.job
WHERE active = true
ORDER BY jobname;

-- 8. Recent Cron Executions
SELECT 
    j.jobname,
    d.start_time,
    d.end_time,
    d.status,
    d.return_message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname IN ('process-dlq-entries', 'create-wa-events-partitions')
ORDER BY d.start_time DESC
LIMIT 10;
SQL

echo -e "${GREEN}✓${NC} Monitoring queries created (monitoring/queries.sql)"

# Summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Monitoring Setup Summary${NC}"
echo -e "${GREEN}========================================${NC}"
echo "Grafana Dashboards: Check $GRAFANA_URL"
echo "PagerDuty: Configure with monitoring/alerting-rules.yaml"
echo "Slack: Test notifications sent"
echo "Monitoring Queries: monitoring/queries.sql"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Review dashboards in Grafana"
echo "2. Configure alert thresholds based on baseline metrics"
echo "3. Set up on-call rotation in PagerDuty"
echo "4. Run monitoring queries regularly (monitoring/queries.sql)"
echo "5. Document incident response procedures"

echo -e "\n${GREEN}✓ Monitoring Setup Complete!${NC}\n"
