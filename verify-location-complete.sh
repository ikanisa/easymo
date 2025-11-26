#!/bin/bash
#
# Location Integration - Complete Verification Script
# Verifies all 7 microservices have proper location handling
#

set -e

echo "🔍 Location Integration - Comprehensive Verification"
echo "====================================================="
echo ""

PROJECT_ROOT=$(pwd)
PASS=0
FAIL=0
WARN=0

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

check_file_has_pattern() {
    local service=$1
    local file=$2
    local pattern=$3
    local description=$4
    
    if [ -f "$file" ]; then
        if grep -q "$pattern" "$file"; then
            echo -e "${GREEN}✅${NC} $service: $description"
            ((PASS++))
            return 0
        else
            echo -e "${RED}❌${NC} $service: Missing $description"
            ((FAIL++))
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️${NC}  $service: File not found - $file"
        ((WARN++))
        return 1
    fi
}

echo "1. wa-webhook-profile"
echo "---------------------"
check_file_has_pattern "Profile" \
    "supabase/functions/wa-webhook-profile/index.ts" \
    "update_user_location_cache" \
    "Cache save on location share"
    
check_file_has_pattern "Profile" \
    "supabase/functions/wa-webhook-profile/index.ts" \
    "saved_locations" \
    "Saved locations support"
echo ""

echo "2. wa-webhook-property"  
echo "----------------------"
check_file_has_pattern "Property" \
    "supabase/functions/wa-webhook-property/property/rentals.ts" \
    "cachePropertyLocation" \
    "Cache integration"
    
check_file_has_pattern "Property" \
    "supabase/functions/wa-webhook-property/handlers/location-handler.ts" \
    "getCachedPropertyLocation\|resolvePropertyLocation" \
    "Location utilities"
echo ""

echo "3. wa-webhook-marketplace"
echo "-------------------------"
check_file_has_pattern "Marketplace" \
    "supabase/functions/wa-webhook-marketplace/index.ts" \
    "get_cached_location" \
    "Cache read integration"
    
check_file_has_pattern "Marketplace" \
    "supabase/functions/wa-webhook-marketplace/index.ts" \
    "saved_locations" \
    "Saved locations support"
    
check_file_has_pattern "Marketplace" \
    "supabase/functions/wa-webhook-marketplace/index.ts" \
    "update_user_location_cache" \
    "Cache save on share"
echo ""

echo "4. wa-webhook-mobility"
echo "----------------------"
check_file_has_pattern "Mobility" \
    "supabase/functions/wa-webhook-mobility/locations/cache.ts" \
    "LocationCache\|getLocationCache\|updateLocationCache\|saveLocationToCache" \
    "Custom cache implementation"
    
check_file_has_pattern "Mobility" \
    "supabase/functions/wa-webhook-mobility/index.ts" \
    "message.type.*location\|type === \"location\"" \
    "Location message handler"
echo ""

echo "5. wa-webhook-jobs"
echo "------------------"
check_file_has_pattern "Jobs" \
    "supabase/functions/wa-webhook-jobs/handlers/location-handler.ts" \
    "getUserLocation\|parseWhatsAppLocation" \
    "Location utilities"
    
check_file_has_pattern "Jobs" \
    "supabase/functions/wa-webhook-jobs/handlers/location-handler.ts" \
    "get_cached_location\|update_user_location_cache" \
    "Cache integration"
    
check_file_has_pattern "Jobs" \
    "supabase/functions/wa-webhook-jobs/handlers/location-handler.ts" \
    "handleLocationMessage\|searchAndSendNearbyJobs" \
    "Location message handler"
echo ""

echo "6. wa-webhook-ai-agents"
echo "-----------------------"
check_file_has_pattern "AI Agents" \
    "supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts" \
    "AgentLocationHelper\|resolveUserLocation" \
    "Shared location helper"
    
check_file_has_pattern "AI Agents" \
    "supabase/functions/wa-webhook-ai-agents/ai-agents/location-helper.ts" \
    "get_cached_location\|saved_locations" \
    "Cache and saved locations"
echo ""

echo "7. wa-webhook-unified"
echo "---------------------"
check_file_has_pattern "Unified" \
    "supabase/functions/wa-webhook-unified/core/location-handler.ts" \
    "resolveUnifiedLocation" \
    "Location resolver"
    
check_file_has_pattern "Unified" \
    "supabase/functions/wa-webhook-unified/core/orchestrator.ts" \
    "resolveUnifiedLocation" \
    "Orchestrator integration"
echo ""

echo "====================================================="
echo "SUMMARY"
echo "====================================================="
echo -e "${GREEN}Passed:${NC}  $PASS"
echo -e "${YELLOW}Warnings:${NC} $WARN"
echo -e "${RED}Failed:${NC}  $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All location integrations verified!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some integrations are missing!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Review failed checks above"
    echo "2. Implement missing features"
    echo "3. Run this script again"
    exit 1
fi
