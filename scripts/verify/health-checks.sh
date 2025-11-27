#!/bin/bash
set -euo pipefail

echo "🏥 Verifying health check endpoints for all services..."

SERVICES=(
  "wallet-service:3000"
  "agent-core:3001"
  "broker-orchestrator:3002"
  "attribution-service:3003"
  "buyer-service:3004"
  "ranking-service:3005"
  "vendor-service:3006"
  "video-orchestrator:3007"
  "voice-bridge:3008"
  "whatsapp-pricing-server:3009"
  "whatsapp-webhook-worker:3010"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

failed_checks=0
passed_checks=0
total_checks=0

for service in "${SERVICES[@]}"; do
  name="${service%%:*}"
  port="${service##*:}"
  
  echo -e "\n${YELLOW}Checking $name on port $port...${NC}"
  
  # Check if service is running
  if ! curl -s "http://localhost:$port/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  $name not running (skipping)${NC}"
    continue
  fi
  
  total_checks=$((total_checks + 3))
  
  # Check main health endpoint
  response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health" 2>/dev/null || echo "000")
  if [ "$response" = "200" ] || [ "$response" = "503" ]; then
    echo -e "${GREEN}✅ /health endpoint exists (HTTP $response)${NC}"
    passed_checks=$((passed_checks + 1))
    
    # Parse JSON response
    health_json=$(curl -s "http://localhost:$port/health")
    echo "   Status: $(echo "$health_json" | jq -r '.status // "unknown"')"
  else
    echo -e "${RED}❌ /health returned HTTP $response${NC}"
    failed_checks=$((failed_checks + 1))
  fi
  
  # Check liveness endpoint
  response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health/liveness" 2>/dev/null || echo "000")
  if [ "$response" = "200" ]; then
    echo -e "${GREEN}✅ /health/liveness endpoint exists${NC}"
    passed_checks=$((passed_checks + 1))
  else
    echo -e "${RED}❌ /health/liveness returned HTTP $response${NC}"
    failed_checks=$((failed_checks + 1))
  fi
  
  # Check readiness endpoint
  response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/health/readiness" 2>/dev/null || echo "000")
  if [ "$response" = "200" ] || [ "$response" = "503" ]; then
    echo -e "${GREEN}✅ /health/readiness endpoint exists${NC}"
    passed_checks=$((passed_checks + 1))
  else
    echo -e "${RED}❌ /health/readiness returned HTTP $response${NC}"
    failed_checks=$((failed_checks + 1))
  fi
done

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Health Check Verification Complete${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "Passed: $passed_checks/$total_checks"
echo -e "Failed: $failed_checks/$total_checks"

if [ $failed_checks -gt 0 ]; then
  echo -e "${RED}Some health checks failed!${NC}"
  exit 1
else
  echo -e "${GREEN}All health checks passed!${NC}"
  exit 0
fi
