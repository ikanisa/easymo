#!/bin/bash
# EasyMO Repository Cleanup - Analysis Script
# Description: Analyzes package usage and provides recommendations
# Risk Level: SAFE - Read-only analysis

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔍 EasyMO Repository Cleanup - Package Usage Analysis"
echo "======================================================"
echo "Repository: $REPO_ROOT"
echo ""

cd "$REPO_ROOT"

# Check if we're in a git repo
if [ ! -d ".git" ]; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

echo "📦 Analyzing package usage across repository..."
echo ""

# Function to check package usage
check_package_usage() {
  local package_name=$1
  local package_path=$2
  
  echo "─────────────────────────────────────────────────"
  echo "Package: $package_name"
  echo "Location: $package_path"
  echo ""
  
  if [ ! -d "$package_path" ]; then
    echo "  ⚠️  Package directory not found"
    echo ""
    return
  fi
  
  # Check imports in TypeScript files
  local ts_count=$(grep -r "from ['\"]$package_name" \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir="$package_path" \
    2>/dev/null | wc -l | tr -d ' ')
  
  # Check require statements
  local js_count=$(grep -r "require(['\"]$package_name" \
    --include="*.js" --include="*.jsx" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir="$package_path" \
    2>/dev/null | wc -l | tr -d ' ')
  
  # Check package.json dependencies
  local dep_count=$(grep -r "\"$package_name\"" \
    --include="package.json" \
    --exclude-dir=node_modules \
    --exclude-dir="$package_path" \
    2>/dev/null | wc -l | tr -d ' ')
  
  local total_count=$((ts_count + js_count))
  
  echo "  Import statements: $ts_count"
  echo "  Require statements: $js_count"
  echo "  Package.json references: $dep_count"
  echo "  TOTAL USAGE: $total_count"
  echo ""
  
  if [ $total_count -eq 0 ] && [ $dep_count -le 1 ]; then
    echo "  ❌ RECOMMENDATION: REMOVE (not used)"
    echo "     Action: rm -rf $package_path"
  elif [ $total_count -le 3 ]; then
    echo "  ⚠️  RECOMMENDATION: CONSOLIDATE (minimal usage)"
    echo "     Consider merging into @easymo/commons"
  else
    echo "  ✅ RECOMMENDATION: KEEP (actively used)"
  fi
  echo ""
}

# Analyze packages
check_package_usage "@easymo/config" "packages/config"
check_package_usage "@easymo/utils" "packages/utils"
check_package_usage "@easymo/clients" "packages/clients"
check_package_usage "@easymo/ui" "packages/ui"

echo "─────────────────────────────────────────────────"
echo ""

# Check for unused services
echo "🔍 Analyzing service dependencies..."
echo ""

check_service_usage() {
  local service_name=$1
  local service_path=$2
  
  echo "Service: $service_name"
  echo "Location: $service_path"
  echo ""
  
  if [ ! -d "$service_path" ]; then
    echo "  ⚠️  Service directory not found"
    echo ""
    return
  fi
  
  # Check if service is in docker-compose
  local docker_count=$(grep -r "$service_name" \
    docker-compose*.yml \
    2>/dev/null | wc -l | tr -d ' ')
  
  # Check if service is imported by other services
  local import_count=$(grep -r "$service_name" \
    services/ apps/ \
    --include="*.ts" --include="*.tsx" --include="*.js" \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude-dir="$service_path" \
    2>/dev/null | wc -l | tr -d ' ')
  
  echo "  Docker Compose references: $docker_count"
  echo "  Code references: $import_count"
  echo ""
  
  if [ $docker_count -eq 0 ] && [ $import_count -eq 0 ]; then
    echo "  ❌ RECOMMENDATION: CONSIDER REMOVAL (not referenced)"
  elif [ $docker_count -eq 0 ]; then
    echo "  ⚠️  WARNING: Not in docker-compose (may be unused)"
  else
    echo "  ✅ RECOMMENDATION: KEEP (actively used)"
  fi
  echo ""
}

check_service_usage "whatsapp-bot" "services/whatsapp-bot"
check_service_usage "voice-bridge" "services/voice-bridge"
check_service_usage "sip-ingress" "services/sip-ingress"
check_service_usage "ai-realtime" "services/ai-realtime"

echo "─────────────────────────────────────────────────"
echo ""

# Check Edge Functions
echo "🔍 Analyzing Edge Function usage..."
echo ""

echo "Potentially removable Edge Functions:"
echo ""

for func in "wa-router" "example-ground-rules" "call-webhook"; do
  if [ -d "supabase/functions/$func" ]; then
    # Check if function is referenced in code
    local ref_count=$(grep -r "$func" \
      --include="*.ts" --include="*.tsx" --include="*.json" \
      --exclude-dir=node_modules \
      --exclude-dir="supabase/functions/$func" \
      2>/dev/null | wc -l | tr -d ' ')
    
    echo "  • supabase/functions/$func/"
    echo "    References in code: $ref_count"
    
    if [ $ref_count -eq 0 ]; then
      echo "    ❌ RECOMMENDATION: REMOVE (not referenced)"
    else
      echo "    ⚠️  RECOMMENDATION: VERIFY references before removal"
    fi
    echo ""
  fi
done

echo "─────────────────────────────────────────────────"
echo ""

# Repository size analysis
echo "📊 Repository Size Analysis"
echo ""
echo "Top 10 largest directories:"
du -sh */ 2>/dev/null | sort -hr | head -10

echo ""
echo "✅ Analysis Complete!"
echo ""
echo "📋 Summary of Recommendations:"
echo ""
echo "Safe to Remove (if analysis shows 0 usage):"
echo "  • Packages with 0 imports"
echo "  • Services not in docker-compose and not imported"
echo "  • Edge Functions with 0 references"
echo ""
echo "Requires Verification:"
echo "  • Packages with 1-3 imports (consider consolidation)"
echo "  • Services with only code references (check if deprecated)"
echo "  • Edge Functions with references (verify usage)"
echo ""
echo "💡 Next Steps:"
echo "  1. Review recommendations above"
echo "  2. For packages marked 'REMOVE', run:"
echo "     rm -rf packages/<package-name>"
echo "  3. Update pnpm-workspace.yaml"
echo "  4. Run: pnpm install"
echo "  5. Test: pnpm build"
echo ""
