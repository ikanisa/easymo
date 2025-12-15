#!/bin/bash
# WA-Webhook Split - Phase 1: Infrastructure Setup
# Creates directory structure, shared packages, and CI/CD pipelines

set -e

PROJECT_ROOT="/Users/jeanbosco/workspace/easymo-"
FUNCTIONS_DIR="$PROJECT_ROOT/supabase/functions"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 WA-WEBHOOK SPLIT - PHASE 1: INFRASTRUCTURE SETUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Step 1: Create microservice directories
echo ""
echo "📁 Step 1/6: Creating microservice directories..."

SERVICES=(
  "wa-webhook-core"
  "wa-webhook-mobility"
  "wa-webhook-property"
  "wa-webhook-marketplace"
  "wa-webhook-jobs"
  "wa-webhook-wallet"
)

for service in "${SERVICES[@]}"; do
  SERVICE_DIR="$FUNCTIONS_DIR/$service"
  if [ ! -d "$SERVICE_DIR" ]; then
    mkdir -p "$SERVICE_DIR"
    echo "  ✅ Created $service/"
  else
    echo "  ⚠️  $service/ already exists"
  fi
  
  # Create standard subdirectories
  mkdir -p "$SERVICE_DIR/handlers"
  mkdir -p "$SERVICE_DIR/utils"
  mkdir -p "$SERVICE_DIR/types"
  mkdir -p "$SERVICE_DIR/tests"
done

# Step 2: Create shared packages structure
echo ""
echo "📦 Step 2/6: Creating shared packages..."

SHARED_DIR="$FUNCTIONS_DIR/_shared/wa-webhook-packages"
mkdir -p "$SHARED_DIR"

PACKAGES=(
  "shared"          # Common types, utilities, clients
  "router"          # Routing logic
  "observability"   # Monitoring & logging
)

for pkg in "${PACKAGES[@]}"; do
  PKG_DIR="$SHARED_DIR/$pkg"
  mkdir -p "$PKG_DIR"
  mkdir -p "$PKG_DIR/src"
  mkdir -p "$PKG_DIR/tests"
  
  # Create package deno.json
  cat > "$PKG_DIR/deno.json" <<EOF
{
  "name": "@easymo/wa-webhook-$pkg",
  "version": "1.0.0",
  "exports": "./src/index.ts",
  "tasks": {
    "test": "deno test --allow-all",
    "check": "deno check src/index.ts"
  }
}
EOF
  
  echo "  ✅ Created @easymo/wa-webhook-$pkg"
done

# Step 3: Create import maps for services
echo ""
echo "🗺️  Step 3/6: Creating import maps..."

for service in "${SERVICES[@]}"; do
  SERVICE_DIR="$FUNCTIONS_DIR/$service"
  
  cat > "$SERVICE_DIR/deno.json" <<EOF
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2",
    "openai": "https://deno.land/x/openai@v4.20.1/mod.ts",
    "@easymo/wa-webhook-shared": "../_shared/wa-webhook-packages/shared/src/index.ts",
    "@easymo/wa-webhook-router": "../_shared/wa-webhook-packages/router/src/index.ts",
    "@easymo/wa-webhook-observability": "../_shared/wa-webhook-packages/observability/src/index.ts"
  },
  "tasks": {
    "test": "deno test --allow-all",
    "dev": "deno run --watch --allow-all index.ts"
  }
}
EOF
  
  echo "  ✅ Created import map for $service"
done

# Step 4: Create function.json for each service
echo ""
echo "⚙️  Step 4/6: Creating function configs..."

for service in "${SERVICES[@]}"; do
  SERVICE_DIR="$FUNCTIONS_DIR/$service"
  
  cat > "$SERVICE_DIR/function.json" <<EOF
{
  "name": "$service",
  "version": "1.0.0",
  "verify_jwt": false,
  "import_map": "./deno.json"
}
EOF
  
  echo "  ✅ Created function.json for $service"
done

# Step 5: Create GitHub Actions workflows
echo ""
echo "🔄 Step 5/6: Creating CI/CD workflows..."

WORKFLOWS_DIR="$PROJECT_ROOT/.github/workflows"
mkdir -p "$WORKFLOWS_DIR"

cat > "$WORKFLOWS_DIR/wa-webhook-microservices.yml" <<'EOF'
name: WA-Webhook Microservices CI

on:
  push:
    paths:
      - 'supabase/functions/wa-webhook-*/**'
      - 'supabase/functions/_shared/wa-webhook-packages/**'
  pull_request:
    paths:
      - 'supabase/functions/wa-webhook-*/**'
      - 'supabase/functions/_shared/wa-webhook-packages/**'

jobs:
  test-shared-packages:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v2.x
      
      - name: Test shared packages
        run: |
          cd supabase/functions/_shared/wa-webhook-packages
          for pkg in shared router observability; do
            echo "Testing $pkg..."
            cd $pkg
            deno test --allow-all
            cd ..
          done

  test-services:
    runs-on: ubuntu-latest
    needs: test-shared-packages
    strategy:
      matrix:
        service: 
          - wa-webhook-core
          - wa-webhook-mobility
          - wa-webhook-property
          - wa-webhook-marketplace
          - wa-webhook-jobs
          - wa-webhook-wallet
    steps:
      - uses: actions/checkout@v3
      - uses: denoland/setup-deno@v1
        with:
          deno-version: v2.x
      
      - name: Test ${{ matrix.service }}
        run: |
          cd supabase/functions/${{ matrix.service }}
          deno test --allow-all
      
      - name: Check TypeScript
        run: |
          cd supabase/functions/${{ matrix.service }}
          deno check index.ts

  deploy:
    runs-on: ubuntu-latest
    needs: test-services
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: supabase/setup-cli@v1
      
      - name: Deploy functions
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
        run: |
          for service in wa-webhook-core wa-webhook-mobility wa-webhook-property wa-webhook-marketplace wa-webhook-jobs wa-webhook-wallet; do
            echo "Deploying $service..."
            supabase functions deploy $service --project-ref $SUPABASE_PROJECT_ID
          done
EOF

echo "  ✅ Created CI/CD workflow"

# Step 6: Create monitoring dashboard config
echo ""
echo "📊 Step 6/6: Creating monitoring configs..."

MONITORING_DIR="$PROJECT_ROOT/monitoring"
mkdir -p "$MONITORING_DIR"

cat > "$MONITORING_DIR/wa-webhook-dashboard.json" <<'EOF'
{
  "dashboard": "WA-Webhook Microservices",
  "panels": [
    {
      "title": "Service Health",
      "services": [
        "wa-webhook-core",
        "wa-webhook-mobility",
        "wa-webhook-property",
        "wa-webhook-marketplace",
        "wa-webhook-jobs",
        "wa-webhook-wallet"
      ],
      "metrics": [
        "health_status",
        "error_rate",
        "p95_latency"
      ]
    },
    {
      "title": "Traffic Distribution",
      "type": "pie",
      "metric": "requests_per_service"
    },
    {
      "title": "Cold Start Times",
      "type": "line",
      "metric": "cold_start_duration_ms"
    },
    {
      "title": "Memory Usage",
      "type": "area",
      "metric": "memory_usage_mb"
    }
  ]
}
EOF

echo "  ✅ Created monitoring dashboard config"

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ PHASE 1 COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Created 7 microservice directories"
echo "📦 Created 3 shared packages"
echo "🗺️  Created import maps for all services"
echo "⚙️  Created function configs"
echo "🔄 Created CI/CD pipeline"
echo "📊 Created monitoring dashboard"
echo ""
echo "🎯 Next Steps:"
echo "  1. Run: ./scripts/wa-webhook-split-phase2.sh"
echo "  2. This will extract shared packages from wa-webhook"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
