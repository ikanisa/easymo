#!/bin/bash
# Location Integration Performance Monitoring
# Tracks cache hit rates, search performance, and usage patterns

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Location Integration Performance Monitor"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DATABASE_URL="${DATABASE_URL}"
MONITOR_INTERVAL=5  # seconds
REPORT_FILE="performance-report-$(date +%Y%m%d_%H%M%S).md"

if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}❌ DATABASE_URL not set${NC}"
  echo "Export it: export DATABASE_URL='postgresql://...'"
  exit 1
fi

# Create monitoring view if not exists
setup_monitoring() {
  echo "Setting up monitoring views..."
  
  psql "$DATABASE_URL" -q <<EOF
-- Create monitoring view
CREATE OR REPLACE VIEW location_performance_metrics AS
SELECT
  -- Cache metrics
  (SELECT COUNT(*) FROM location_cache WHERE created_at > NOW() - INTERVAL '30 minutes') as active_caches,
  (SELECT COUNT(*) FROM location_cache WHERE created_at <= NOW() - INTERVAL '30 minutes' AND created_at > NOW() - INTERVAL '24 hours') as expired_caches_24h,
  (SELECT AVG(EXTRACT(EPOCH FROM NOW() - created_at)) FROM location_cache WHERE created_at > NOW() - INTERVAL '30 minutes') as avg_cache_age_seconds,
  
  -- Hit rate calculation
  CASE 
    WHEN (SELECT COUNT(*) FROM location_cache WHERE created_at > NOW() - INTERVAL '24 hours') > 0
    THEN ROUND(
      (SELECT COUNT(*) FROM location_cache WHERE created_at > NOW() - INTERVAL '30 minutes')::numeric / 
      (SELECT COUNT(*) FROM location_cache WHERE created_at > NOW() - INTERVAL '24 hours')::numeric * 100,
      2
    )
    ELSE 0
  END as cache_hit_rate_percent,
  
  -- Saved locations
  (SELECT COUNT(*) FROM saved_locations WHERE created_at > NOW() - INTERVAL '24 hours') as saved_locations_24h,
  (SELECT COUNT(DISTINCT user_id) FROM saved_locations) as users_with_saved_locations,
  
  -- Activity metrics
  (SELECT COUNT(DISTINCT user_id) FROM location_cache WHERE created_at > NOW() - INTERVAL '1 hour') as active_users_1h,
  (SELECT COUNT(DISTINCT user_id) FROM location_cache WHERE created_at > NOW() - INTERVAL '24 hours') as active_users_24h,
  
  -- Geographic distribution (top country)
  (SELECT country FROM location_cache WHERE country IS NOT NULL GROUP BY country ORDER BY COUNT(*) DESC LIMIT 1) as top_country,
  
  -- Service usage
  (SELECT COUNT(*) FROM location_cache WHERE context = 'jobs' AND created_at > NOW() - INTERVAL '1 hour') as jobs_usage_1h,
  (SELECT COUNT(*) FROM location_cache WHERE context = 'marketplace' AND created_at > NOW() - INTERVAL '1 hour') as marketplace_usage_1h,
  (SELECT COUNT(*) FROM location_cache WHERE context = 'mobility' AND created_at > NOW() - INTERVAL '1 hour') as mobility_usage_1h,
  
  NOW() as snapshot_time;

-- Grant access
GRANT SELECT ON location_performance_metrics TO anon, authenticated;
EOF
  
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Monitoring views created${NC}"
  else
    echo -e "${RED}❌ Failed to create monitoring views${NC}"
    exit 1
  fi
}

# Display real-time metrics
display_metrics() {
  clear
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📊 Location Integration - Live Metrics"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  
  # Fetch metrics
  METRICS=$(psql "$DATABASE_URL" -tAF'|' -c "SELECT * FROM location_performance_metrics;")
  
  # Parse metrics
  IFS='|' read -r \
    active_caches \
    expired_caches \
    avg_age \
    hit_rate \
    saved_24h \
    users_saved \
    active_1h \
    active_24h \
    top_country \
    jobs_1h \
    marketplace_1h \
    mobility_1h \
    snapshot <<< "$METRICS"
  
  # Cache Statistics
  echo -e "${BLUE}📦 Cache Statistics${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Active Caches (last 30min):   $active_caches"
  echo "Expired Caches (last 24h):    $expired_caches"
  
  # Format average age
  if [ ! -z "$avg_age" ] && [ "$avg_age" != "" ]; then
    avg_age_min=$(echo "scale=1; $avg_age / 60" | bc)
    echo "Average Cache Age:            ${avg_age_min} minutes"
  else
    echo "Average Cache Age:            N/A"
  fi
  
  # Hit rate with color coding
  echo -n "Cache Hit Rate:               "
  if (( $(echo "$hit_rate >= 60" | bc -l) )); then
    echo -e "${GREEN}${hit_rate}%${NC} ✅"
  elif (( $(echo "$hit_rate >= 40" | bc -l) )); then
    echo -e "${YELLOW}${hit_rate}%${NC} ⚠️"
  else
    echo -e "${RED}${hit_rate}%${NC} ❌"
  fi
  
  echo ""
  
  # User Activity
  echo -e "${BLUE}👥 User Activity${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Active Users (last 1h):       $active_1h"
  echo "Active Users (last 24h):      $active_24h"
  echo "Users with Saved Locations:   $users_saved"
  echo "Saved Locations (last 24h):   $saved_24h"
  echo ""
  
  # Service Usage
  echo -e "${BLUE}🔧 Service Usage (Last Hour)${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Jobs Service:                 $jobs_1h requests"
  echo "Marketplace Service:          $marketplace_1h requests"
  echo "Mobility Service:             $mobility_1h requests"
  echo ""
  
  # Geographic
  echo -e "${BLUE}🌍 Geographic Distribution${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Top Country:                  ${top_country:-Unknown}"
  echo ""
  
  # Health Indicators
  echo -e "${BLUE}🏥 Health Indicators${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Check cache hit rate
  if (( $(echo "$hit_rate >= 60" | bc -l) )); then
    echo -e "${GREEN}✅${NC} Cache performance: EXCELLENT"
  elif (( $(echo "$hit_rate >= 40" | bc -l) )); then
    echo -e "${YELLOW}⚠️${NC}  Cache performance: ACCEPTABLE"
  else
    echo -e "${RED}❌${NC} Cache performance: NEEDS ATTENTION"
  fi
  
  # Check active users
  if [ "$active_1h" -gt 0 ]; then
    echo -e "${GREEN}✅${NC} User activity: ACTIVE"
  else
    echo -e "${YELLOW}⚠️${NC}  User activity: LOW"
  fi
  
  # Check service distribution
  total_usage=$((jobs_1h + marketplace_1h + mobility_1h))
  if [ "$total_usage" -gt 0 ]; then
    echo -e "${GREEN}✅${NC} Services: OPERATIONAL"
  else
    echo -e "${YELLOW}⚠️${NC}  Services: NO RECENT ACTIVITY"
  fi
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Press Ctrl+C to stop monitoring"
  echo "Next update in ${MONITOR_INTERVAL} seconds..."
}

# Run performance benchmark
run_benchmark() {
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}⚡ Running Performance Benchmark${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  
  # Test 1: Cache lookup speed
  echo "Test 1: Cache Lookup Speed (100 iterations)"
  START=$(date +%s%N)
  for i in {1..100}; do
    psql "$DATABASE_URL" -tAc "SELECT * FROM get_cached_location('test_user_$i');" &>/dev/null
  done
  END=$(date +%s%N)
  DURATION=$(( (END - START) / 1000000 ))  # Convert to ms
  AVG=$(( DURATION / 100 ))
  
  echo "Total time: ${DURATION}ms"
  echo -n "Average per lookup: ${AVG}ms - "
  if [ $AVG -lt 10 ]; then
    echo -e "${GREEN}EXCELLENT${NC}"
  elif [ $AVG -lt 20 ]; then
    echo -e "${YELLOW}GOOD${NC}"
  else
    echo -e "${RED}SLOW${NC}"
  fi
  echo ""
  
  # Test 2: GPS search speed
  echo "Test 2: GPS Search Speed (50 iterations)"
  START=$(date +%s%N)
  for i in {1..50}; do
    psql "$DATABASE_URL" -tAc "SELECT * FROM nearby_jobs(-1.9441, 30.0619, 5000, 10);" &>/dev/null
  done
  END=$(date +%s%N)
  DURATION=$(( (END - START) / 1000000 ))
  AVG=$(( DURATION / 50 ))
  
  echo "Total time: ${DURATION}ms"
  echo -n "Average per search: ${AVG}ms - "
  if [ $AVG -lt 50 ]; then
    echo -e "${GREEN}EXCELLENT${NC}"
  elif [ $AVG -lt 100 ]; then
    echo -e "${YELLOW}GOOD${NC}"
  else
    echo -e "${RED}SLOW${NC}"
  fi
  echo ""
  
  # Test 3: Concurrent requests
  echo "Test 3: Concurrent Requests (20 simultaneous)"
  START=$(date +%s%N)
  for i in {1..20}; do
    psql "$DATABASE_URL" -tAc "SELECT * FROM nearby_jobs(-1.9441, 30.0619, 5000, 10);" &>/dev/null &
  done
  wait
  END=$(date +%s%N)
  DURATION=$(( (END - START) / 1000000 ))
  
  echo "Total time: ${DURATION}ms"
  echo -n "Performance under load: "
  if [ $DURATION -lt 500 ]; then
    echo -e "${GREEN}EXCELLENT${NC}"
  elif [ $DURATION -lt 1000 ]; then
    echo -e "${YELLOW}GOOD${NC}"
  else
    echo -e "${RED}NEEDS OPTIMIZATION${NC}"
  fi
  echo ""
}

# Generate detailed report
generate_report() {
  echo "Generating detailed report..."
  
  cat > "$REPORT_FILE" <<EOF
# Location Integration Performance Report
**Generated**: $(date '+%Y-%m-%d %H:%M:%S')
**Environment**: Production

---

## Executive Summary

EOF

  # Fetch current metrics
  METRICS=$(psql "$DATABASE_URL" -tAF'|' -c "SELECT * FROM location_performance_metrics;")
  IFS='|' read -r \
    active_caches \
    expired_caches \
    avg_age \
    hit_rate \
    saved_24h \
    users_saved \
    active_1h \
    active_24h \
    top_country \
    jobs_1h \
    marketplace_1h \
    mobility_1h \
    snapshot <<< "$METRICS"
  
  # Overall status
  if (( $(echo "$hit_rate >= 60" | bc -l) )); then
    echo "**Overall Status**: ✅ EXCELLENT" >> "$REPORT_FILE"
  elif (( $(echo "$hit_rate >= 40" | bc -l) )); then
    echo "**Overall Status**: ⚠️ GOOD" >> "$REPORT_FILE"
  else
    echo "**Overall Status**: ❌ NEEDS ATTENTION" >> "$REPORT_FILE"
  fi
  
  cat >> "$REPORT_FILE" <<EOF

---

## Key Metrics

### Cache Performance
- **Active Caches**: $active_caches
- **Cache Hit Rate**: ${hit_rate}%
- **Average Age**: $(echo "scale=1; $avg_age / 60" | bc) minutes
- **Expired (24h)**: $expired_caches

### User Activity
- **Active Users (1h)**: $active_1h
- **Active Users (24h)**: $active_24h
- **Users with Saved Locations**: $users_saved
- **New Saved Locations (24h)**: $saved_24h

### Service Usage (Last Hour)
- **Jobs**: $jobs_1h requests
- **Marketplace**: $marketplace_1h requests
- **Mobility**: $mobility_1h requests
- **Total**: $((jobs_1h + marketplace_1h + mobility_1h)) requests

### Geographic
- **Top Country**: ${top_country:-Unknown}

---

## Recommendations

EOF

  # Add recommendations based on metrics
  if (( $(echo "$hit_rate < 40" | bc -l) )); then
    echo "1. ⚠️ **Low cache hit rate** - Consider increasing TTL or user education" >> "$REPORT_FILE"
  fi
  
  if [ "$active_1h" -lt 5 ]; then
    echo "1. ⚠️ **Low user activity** - Marketing or feature awareness needed" >> "$REPORT_FILE"
  fi
  
  total_usage=$((jobs_1h + marketplace_1h + mobility_1h))
  if [ "$total_usage" -lt 10 ]; then
    echo "1. ⚠️ **Low service usage** - Check service availability" >> "$REPORT_FILE"
  fi
  
  if (( $(echo "$hit_rate >= 60" | bc -l) )) && [ "$active_1h" -gt 10 ]; then
    echo "1. ✅ **Performance excellent** - Continue monitoring" >> "$REPORT_FILE"
    echo "2. ✅ **User engagement good** - Scale as needed" >> "$REPORT_FILE"
  fi
  
  echo ""
  echo -e "${GREEN}📄 Report saved to: $REPORT_FILE${NC}"
}

# Main menu
show_menu() {
  echo ""
  echo "Select monitoring mode:"
  echo "1) Real-time monitoring (live updates)"
  echo "2) Run performance benchmark"
  echo "3) Generate detailed report"
  echo "4) All of the above"
  echo "5) Exit"
  echo ""
  read -p "Enter choice [1-5]: " choice
  
  case $choice in
    1)
      echo "Starting real-time monitoring..."
      sleep 2
      while true; do
        display_metrics
        sleep $MONITOR_INTERVAL
      done
      ;;
    2)
      run_benchmark
      read -p "Press Enter to continue..."
      show_menu
      ;;
    3)
      generate_report
      read -p "Press Enter to continue..."
      show_menu
      ;;
    4)
      run_benchmark
      echo ""
      generate_report
      echo ""
      echo "Starting real-time monitoring in 3 seconds..."
      sleep 3
      while true; do
        display_metrics
        sleep $MONITOR_INTERVAL
      done
      ;;
    5)
      echo "Exiting..."
      exit 0
      ;;
    *)
      echo "Invalid choice"
      show_menu
      ;;
  esac
}

# Main
main() {
  setup_monitoring
  show_menu
}

# Trap Ctrl+C
trap 'echo -e "\n${YELLOW}Monitoring stopped${NC}"; generate_report; exit 0' INT

main
